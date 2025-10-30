// pages/api/design-handshake.js

let store = globalThis.__DOBO_DESIGNS__;
if (!store) {
  store = new Map();
  globalThis.__DOBO_DESIGNS__ = store;
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const {
        designId,
        preview,
        overlay,
        layerImg,
        layerText,
        pot,
        plant,
        color,
        size,
      } = body || {};

      if (!designId) {
        return res.status(400).json({ ok: false, error: "missing-designId" });
      }

      store.set(designId, {
        ts: Date.now(),
        preview: preview || "",
        overlay: overlay || "",
        layerImg: layerImg || "",
        layerText: layerText || "",
        pot: pot || null,
        plant: plant || null,
        color: color || "",
        size: size || "",
      });

      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  }

  if (req.method === "GET") {
    const { designId } = req.query || {};
    if (!designId) {
      return res.status(400).json({ ok: false, error: "missing-designId" });
    }
    const data = store.get(designId);
    if (!data) {
      return res.status(404).json({ ok: false, error: "not-found" });
    }
    return res.status(200).json({ ok: true, design: data });
  }

  return res.status(405).json({ ok: false, error: "method-not-allowed" });
}
