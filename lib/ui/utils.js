export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function money(amount, currency = "CLP") {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount || 0));
}
export function num(v) { return Number(typeof v === "object" ? v?.amount : v || 0); }
export const firstVariantPrice = (p) => { const v = p?.variants?.[0]?.price; return v ? num(v) : num(p?.minPrice); };
export const productMin = (p) => num(p?.minPrice);
export const escapeHtml = (s) => (s ? s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])) : "");
export const buildIframeHTML = (imgUrl, title, desc) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:#fff;font-family:system-ui,sans-serif}.wrap{padding:8px;display:flex;flex-direction:column;align-items:center;gap:8px}img{max-width:100%;height:auto;display:block}h4{margin:0;font-size:14px;font-weight:600;text-align:center}p{margin:0;font-size:12px;line-height:1.35;text-align:center;color:#333}</style></head><body><div class="wrap"><img src="${escapeHtml(imgUrl || "")}" alt=""><h4>${escapeHtml(title || "")}</h4><p>${escapeHtml(desc || "")}</p></div></body></html>`;
export function getPreviewRect() { if (typeof window === "undefined") return { w: 360, h: 360, centered: false }; const m = window.innerWidth <= 768; const w = m ? Math.min(window.innerWidth - 24, 420) : 360; const h = m ? Math.min(Math.floor(window.innerHeight * 0.6), 520) : 360; return { w, h, centered: m }; }
export function makeSwipeEvents(swipeRef, handlers) {
  const begin = (x, y, id, el) => { swipeRef.current = { active: true, id, x, y }; if (id != null && el?.setPointerCapture) el.setPointerCapture(id); };
  const end = (ev, el) => { const id = swipeRef.current?.id; if (id != null && el?.releasePointerCapture) el.releasePointerCapture(id); swipeRef.current = { active: false, id: null, x: 0, y: 0 }; };
  const move = (x, y, ev, el) => { const s = swipeRef.current; if (!s?.active) return; const dx = x - s.x, dy = y - s.y; if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) { ev.preventDefault(); if (Math.abs(dx) > 48) { dx > 0 ? handlers.prev() : handlers.next(); end(ev, el); } } };
  return {
    onPointerDown: (e) => begin(e.clientX, e.clientY, e.pointerId ?? null, e.currentTarget),
    onPointerMove: (e) => move(e.clientX, e.clientY, e, e.currentTarget),
    onPointerUp: (e) => end(e, e.currentTarget),
    onPointerCancel: (e) => end(e, e.currentTarget),
    onTouchStart: (e) => { const t = e.touches[0]; begin(t.clientX, t.clientY, null, e.currentTarget); },
    onTouchMove: (e) => { const t = e.touches[0]; move(t.clientX, t.clientY, e, e.currentTarget); },
    onTouchEnd: (e) => end(e, e.currentTarget),
    onTouchCancel: (e) => end(e, e.currentTarget),
    onMouseDown: (e) => begin(e.clientX, e.clientY, null, e.currentTarget),
    onMouseMove: (e) => move(e.clientX, e.clientY, e, e.currentTarget),
    onMouseUp: (e) => end(e, e.currentTarget),
  };
}
