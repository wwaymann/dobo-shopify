// lib/publishDesignClient.js
import { exportPreviewDataURL } from './designStore';

function safeSlice255(s) { return String(s || '').slice(0, 255); }

/**
 * Publica el diseño actual, adjunta a metacampos del producto
 * y devuelve atributos para la línea del carrito.
 */
export async function publishAndAttachDesign({ productHandle, designId }) {
  const api = globalThis?.doboDesignAPI;
  const snap = api?.exportDesignSnapshot?.();
  if (!api || !snap) return [];

  const canvas = api.getCanvas?.() || api.canvas;
  const dataURL = exportPreviewDataURL(canvas, { multiplier: 2 });
  if (!dataURL) return [];

  const r = await fetch('/api/design/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      design: snap,
      meta: snap?.meta ?? {},
      previewDataURL: dataURL,
      designId,
      productHandle // clave para escribir metacampos automáticamente
    })
  });
  if (!r.ok) return [];

  const { previewUrl, jsonUrl, id } = await r.json();
  return [
    { key: 'DOBO_PREVIEW',     value: safeSlice255(previewUrl) },
    { key: 'DOBO_DESIGN_URL',  value: safeSlice255(jsonUrl) },
    { key: 'DOBO_DESIGN_ID',   value: safeSlice255(id) },
    { key: 'DOBO_VERSION',     value: 'v1' }
  ];
}
