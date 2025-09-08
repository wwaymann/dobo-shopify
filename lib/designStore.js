// lib/designStore.js
const KEY = 'dobo.design.autosave.v1';

export function saveLocalDesign(snapshot) {
  try { localStorage.setItem(KEY, JSON.stringify(snapshot)); } catch {}
}
export function loadLocalDesign() {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}

export function exportPreviewDataURL(canvas, { mime='image/png', multiplier=2 } = {}) {
  if (!canvas) return null;
  return canvas.toDataURL({ format: mime.includes('png') ? 'png' : 'jpeg', multiplier, backgroundColor: 'transparent' });
}
export async function dataURLtoBase64Attachment(dataURL) {
  // devuelve el mismo dataURL (Shopify Admin API acepta base64 de imagen sin encabezado si lo necesitas)
  return dataURL;
}
