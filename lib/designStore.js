// lib/designStore.js
export function exportPreviewDataURL(canvas, opts = {}) {
  if (!canvas) return null;
  const { multiplier = 1 } = opts;
  try {
    if (typeof canvas.toDataURL === 'function') {
      return canvas.toDataURL({ format: 'png', multiplier });
    }
    const el = canvas.getElement?.() || canvas;
    return el?.toDataURL ? el.toDataURL('image/png') : null;
  } catch {
    return null;
  }
}

export async function dataURLtoBase64Attachment(dataURL) {
  if (!dataURL) return '';
  const s = String(dataURL);
  const base64 = s.includes(',') ? s.split(',')[1] : s;
  return base64;
}

export function loadLocalDesign(key = 'dobo_design_snapshot') {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
