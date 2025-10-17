// lib/designStore.js  (añadir al final)

// Exporta un PNG con SOLO objetos del tipo indicado (image o text)
export async function exportOnly(names = [], opts = {}) {
  try {
    const mult = Number(opts.multiplier ?? 2);
    const api = typeof window !== 'undefined' ? window.doboDesignAPI : null;
    const c = api?.getCanvas?.();
    if (!c?.getObjects) return null;

    const wantImage = names.map(String).some(n => /image|imagen|plant|planta/i.test(n));
    const wantText  = names.map(String).some(n => /text|texto/i.test(n));
    const kind = wantImage ? 'image' : wantText ? 'text' : '';

    if (!kind) return null;

    const hidden = [];
    c.getObjects().forEach(o => {
      const isImg = o.type === 'image';
      const isTxt = (o.type === 'i-text' || o.type === 'textbox' || o.type === 'text');
      const keep = (kind === 'image' && isImg) || (kind === 'text' && isTxt);
      if (!keep) { hidden.push(o); o.__wasVisible = o.visible; o.visible = false; }
    });

    const url = c.toDataURL({ format: 'png', multiplier: mult, backgroundColor: 'transparent' });

    hidden.forEach(o => { o.visible = (o.__wasVisible !== false); delete o.__wasVisible; });
    c.requestRenderAll();

    return url;
  } catch { return null; }
}

export async function exportLayerAllPNG(opts = {}) {
  const img = await exportOnly(['image'], opts);
  const txt = await exportOnly(['text'],  opts);
  const out = [];
  if (img) out.push({ name: 'image', dataUrl: img });
  if (txt) out.push({ name: 'text',  dataUrl: txt });
  return out;
}
