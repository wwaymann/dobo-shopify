// pages/api/upload-design.js
export const config = {
  api: { bodyParser: { sizeLimit: "25mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Only POST" });

  try {
    // Soporta body como string o como objeto
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { /* ignore */ }
    }

    const { dataUrl, filename = `design-${Date.now()}.jpg` } = body || {};
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) {
      // Diagnóstico útil en respuesta
      return res.status(400).json({
        error: "dataUrl required (must be data:image/*;base64,...)",
        receivedType: typeof dataUrl,
        preview: typeof dataUrl === "string" ? dataUrl.slice(0, 32) : null,
      });
    }

    const cloud  = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UNSIGNED_PRESET;
    if (!cloud || !preset) {
      return res.status(500).json({ error: "Missing NEXT_PUBLIC_CLOUDINARY_* env vars" });
    }

    const form = new FormData();                // Node 18+ ok
    form.append("file", dataUrl);               // Cloudinary acepta dataURL directo
    form.append("upload_preset", preset);
    form.append("public_id", filename.replace(/\.[a-z0-9]+$/i, "")); // opcional

    const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
      method: "POST",
      body: form,
    });
    const j = await r.json();

    if (!r.ok || j.error) {
      return res.status(r.status || 500).json({ error: j?.error?.message || "Cloudinary upload failed", raw: j });
    }

    return res.status(200).json({ url: j.secure_url });
  } catch (e) {
    console.error("upload-design error:", e);
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
