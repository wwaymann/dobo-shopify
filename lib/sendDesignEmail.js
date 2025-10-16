// lib/sendDesignEmail.js
function findAttr(attrs, name) {
  const n = String(name || "").toLowerCase();
  const it = (attrs || []).find(a => String(a?.key || "").toLowerCase() === n);
  return it?.value || "";
}

export function attrsToEmailPayload(attrs = [], extras = {}) {
  const preview = findAttr(attrs, "_designpreview") || findAttr(attrs, "designpreview") || "";
  const id = findAttr(attrs, "_designid") || findAttr(attrs, "designid") || `dobo-${Date.now()}`;

  const layerNames = [
    "_layerallpng", "_layermaskpng", "_layersvg", "_layertoppng", "_layersidepng",
    "layerallpng", "layermaskpng", "layersvg", "layertoppng", "layersidepng"
  ];

  const layers = layerNames
    .map(n => ({ name: n.replace(/^_/, "").toUpperCase(), url: findAttr(attrs, n) }))
    .filter(x => !!x.url);

  const meta = {
    Color: findAttr(attrs, "_color") || findAttr(attrs, "color"),
    Tamaño: findAttr(attrs, "_size") || findAttr(attrs, "size"),
    Planta: findAttr(attrs, "_planttitle") || findAttr(attrs, "planttitle"),
    Maceta: findAttr(attrs, "_pottitle") || findAttr(attrs, "pottitle"),
    Precio: findAttr(attrs, "_price") || findAttr(attrs, "price"),
    VariantId: findAttr(attrs, "_variantid"),
    ...extras.meta,
  };

  const links = { ...(extras.links || {}) };
  return { designId: id, previewUrl: preview, layers, meta, links };
}

export async function sendDesignEmail(attrs, extras = {}) {
  const payload = attrsToEmailPayload(attrs, extras);
  try {
    const resp = await fetch("/api/send-design-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify(payload),
    });
    return await resp.json(); // { ok: true/false, id?, error? }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
