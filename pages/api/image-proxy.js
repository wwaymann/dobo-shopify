// pages/api/image-proxy.js
export default async function handler(req, res) {
  try {
    const { url } = req.query || {};
    if (!url) return res.status(400).json({ error: "Missing url" });

    // Whitelist de dominios permitidos
    const ALLOW = new Set([
      "cdn.shopify.com",
      "images.shopifycdn.com",
      "shopifycdn.net",
      "res.cloudinary.com"
    ]);
    const u = new URL(url);
    if (!ALLOW.has(u.hostname)) {
      return res.status(400).json({ error: "Host no permitido" });
    }

    // Fetch server-side para evitar CORS en el cliente
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: "Fetch falló" });

    const ct = r.headers.get("content-type") || "image/png";
    const arr = new Uint8Array(await r.arrayBuffer());
    const b64 = Buffer.from(arr).toString("base64");
    const dataUrl = `data:${ct};base64,${b64}`;

    return res.status(200).json({ dataUrl });
  } catch (e) {
    return res.status(500).json({ error: e.message || "proxy-error" });
  }
}
