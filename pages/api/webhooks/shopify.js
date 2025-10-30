// pages/api/webhooks/shopify.js
import crypto from "crypto";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function verifyShopifyHmac(rawBody, hmacHeader, secret) {
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  return crypto.timingSafeEqual(
    Buffer.from(digest, "utf8"),
    Buffer.from(hmacHeader || "", "utf8")
  );
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    // tu health
    return res.status(200).json({ ok: true, path: "/api/webhooks/shopify" });
  }

  if (req.method !== "POST") {
    return res.status(200).json({ ok: true });
  }

  const rawBody = await readRawBody(req);
  const shop = req.headers["x-shopify-shop-domain"] || "";
  const topic = req.headers["x-shopify-topic"] || "";
  const hmac = req.headers["x-shopify-hmac-sha256"] || "";
  const secret =
    process.env.SHOPIFY_WEBHOOK_SECRET ||
    process.env.SHOPIFY_API_SECRET ||
    "";

  if (secret) {
    const ok = verifyShopifyHmac(rawBody, hmac, secret);
    if (!ok) {
      return res.status(401).json({ ok: false, error: "bad-hmac" });
    }
  }

  const payload = JSON.parse(rawBody || "{}");

  if (topic !== "orders/paid") {
    return res.status(200).json({ ok: true, skip: true });
  }

  const orderId = payload.id;
  const line = Array.isArray(payload.line_items) ? payload.line_items[0] : null;
  const props = Array.isArray(line?.properties) ? line.properties : [];

  const attrs = props.map((p) => ({ key: p.name, value: p.value }));

  // 1) buscamos el designId que el frontend guardó
  const designId =
    attrs.find((a) => a.key === "_DesignId")?.value ||
    attrs.find((a) => a.key === "DesignId")?.value ||
    "";

  let designData = null;
  if (designId) {
    try {
      const base =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");

      const r = await fetch(
        `${base}/api/design-handshake?designId=${encodeURIComponent(designId)}`
      );
      const j = await r.json();
      if (j?.ok) {
        designData = j.design;
      }
    } catch (e) {
      console.error("[webhook] no se pudo cargar handshake:", e);
    }
  }

  // 2) si tenemos diseño, mandamos correo
  if (designData) {
    try {
      const base =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");

      await fetch(`${base}/api/send-design-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `DOBO – Pedido pagado ${orderId || ""}`,
          orderId,
          shop,
          paid: true,
          designId,
          preview: designData.preview,
          overlay: designData.overlay,
          layerImg: designData.layerImg,
          layerText: designData.layerText,
          pot: designData.pot,
          plant: designData.plant,
          color: designData.color,
          size: designData.size,
          rawProps: attrs,
        }),
      });
    } catch (e) {
      console.error("[webhook] error enviando correo:", e);
    }
  }

  // 3) responder health como el que viste
  return res.status(200).json({
    ok: true,
    last: {
      topic,
      shop,
      paid: true,
      orderId,
      attrs,
      designId,
      hasDesign: !!designData,
      ts: Date.now(),
    },
  });
}
