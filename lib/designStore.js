// /lib/designStore.js
// Persistencia en localStorage + helper para preview PNG
export const DESIGN_LS_KEY = 'dobo.design.autosave.v1';

export function saveLocalDesign(designState) {
  try {
    const payload = {
      v: 1,
      t: Date.now(),
      data: designState,
    };
    localStorage.setItem(DESIGN_LS_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadLocalDesign() {
  try {
    const raw = localStorage.getItem(DESIGN_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data || null;
  } catch {
    return null;
  }
}

export function clearLocalDesign() {
  try { localStorage.removeItem(DESIGN_LS_KEY); } catch {}
}

export async function canvasToDataURL(canvasEl, mime = 'image/png', quality) {
  // Acepta <canvas> o un método getCanvas()
  const canvas = canvasEl?.getContext ? canvasEl : (canvasEl?.getCanvas ? canvasEl.getCanvas() : null);
  if (!canvas) throw new Error('Canvas no disponible para exportar preview.');
  return canvas.toDataURL(mime, quality);
}

export async function dataURLtoBase64Attachment(dataURL) {
  // Shopify REST images acepta "attachment" base64 sin el prefijo dataURL
  if (typeof dataURL !== 'string' || !dataURL.startsWith('data:')) {
    throw new Error('dataURL inválido');
  }
  const base64 = dataURL.split(',')[1];
  return base64;
}

