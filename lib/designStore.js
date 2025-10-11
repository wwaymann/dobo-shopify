// lib/designStore.js
// Helpers usados por pages/index.js y el API de CustomizationOverlay.

function getCanvasFromAPI() {
  try {
    if (typeof window === 'undefined') return null;
    const api = window.doboDesignAPI;
    if (api && typeof api.getCanvas === 'function') {
      return api.getCanvas();
    }
  } catch {}
  return null;
}

/**
 * PNG dataURL del canvas actual (fondo transparente).
 * Acepta un canvas de Fabric o usa window.doboDesignAPI.getCanvas().
 */
export function exportPreviewDataURL(canvas, opts = {}) {
  if (!canvas) canvas = getCanvasFromAPI();
  if (!canvas) return null;

  const { multiplier = 1 } = opts;
  try {
    if (typeof canvas.toDataURL === 'function') {
      return canvas.toDataURL({ format: 'png', multiplier, backgroundColor: 'transparent' });
    }
    const el = canvas.getElement?.() || canvas;
    return el?.toDataURL ? el.toDataURL('image/png') : null;
  } catch {
    return null;
  }
}

/** Convierte dataURL → base64 (para adjuntos). */
export async function dataURLtoBase64Attachment(dataURL) {
  if (!dataURL) return '';
  const s = String(dataURL);
  const base64 = s.includes(',') ? s.split(',')[1] : s;
  return base64;
}

/** Lee un snapshot local del diseño (JSON). */
export function loadLocalDesign(key = 'dobo_design_snapshot') {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** PNG con *todas* las capas visibles del editor. */
export async function exportLayerAllPNG(mult = 3) {
  try {
    if (typeof window === 'undefined') return null;
    const api = window.doboDesignAPI;
    if (api && typeof api.exportLayerPNGs === 'function') {
      const out = await api.exportLayerPNGs(mult);
      return out?.all ?? null;
    }
  } catch {}
  return null;
}

/** PNG de una capa lógica específica: "text" o "image". */
export async function exportOnly(kind = 'text', mult = 3) {
  try {
    if (typeof window === 'undefined') return null;
    const api = window.doboDesignAPI;
    if (api && typeof api.exportLayerPNGs === 'function') {
      const out = await api.exportLayerPNGs(mult);
      if (kind === 'text')  return out?.text  ?? null;
      if (kind === 'image') return out?.image ?? null;
    }
  } catch {}
  return null;
}
