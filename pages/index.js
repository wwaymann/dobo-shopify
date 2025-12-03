// pages/index.js
import { useEffect, useState, useRef } from "react";
import styles from "../styles/home.module.css";
import "bootstrap/dist/css/bootstrap.min.css";
import dynamic from "next/dynamic";


// ============ HELPERS DOBO (pegar una sola vez, arriba de pages/index.js) ============
import * as DS from "../lib/designStore"; // namespace import (sin destructuring)

// Busca un attr por nombre, ignorando '_' inicial y case-insensitive
function getAttrCI(attrs, name) {
  const target = String(name||"").toLowerCase();
  const hit = (attrs||[]).find(a => String(a?.key||"").toLowerCase().replace(/^_/, "") === target);
  return hit?.value || "";
}



// --- UTIL: marcar dirty hacia arriba (rompe cache de grupos) ---
function markDirty(o) {
  if (!o) return;
  o.dirty = true;
  if (o.group) markDirty(o.group);
}

// ---------- Utils básicos ----------
const gidToNum = (id) => {
  const s = String(id || "");
  return s.includes("gid://") ? s.split("/").pop() : s;
};

// Sube dataURL/blob/http a https (Cloudinary) mediante tu API local
async function ensureHttpsUrl(u, namePrefix = "img") {
  try {
    const s = String(u || "");
    if (!s) return "";
    if (/^https:\/\//i.test(s)) return s;
    if (/^data:|^blob:|^http:\/\//i.test(s)) {
      const r = await fetch("/api/upload-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: s, filename: `${namePrefix}-${Date.now()}.png` })
      });
      const j = await r.json().catch(() => ({}));
      return j?.url || "";
    }
    return "";
  } catch {
    return "";
  }
}

// Filtra attrs para el email (incluye DO/NO si existen)
function shrinkAttrsForEmail(attrs = []) {
  const keep = new Set([
    "_designid","designid","_designpreview","designpreview",
    "overlay:all","layer:image","layer:text"
  ]);
  const out = [];
  for (const a of (attrs || [])) {
    const k = String(a?.key || "").toLowerCase();
    const v = String(a?.value ?? "");
    if (keep.has(k) || k.startsWith("layer:") || k.startsWith("overlay:")) {
      out.push({ key: a.key, value: v });
    }
  }
  for (const k of ["_DO","_NO"]) {
    const hit = (attrs || []).find(a => a.key === k);
    if (hit) out.push({ key: k, value: String(hit.value || "") });
  }
  return out.slice(0, 100);
}

// Envía email sin bloquear navegación
function sendEmailNow(payload) {
  try {
    const url = new URL("/api/send-design-email", location.origin).toString();
    const json = JSON.stringify(payload);
    if (navigator.sendBeacon && json.length < 64000) {
      const blob = new Blob([json], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: json })
      .then(r => r.json()).then(r => { if (!r?.ok) console.warn("[email] not ok", r); })
      .catch(err => console.warn("[email] error", err));
  } catch (e) { console.warn("sendEmailNow failed", e); }
}

// ---------- Fallbacks de exportación (por si DS no exporta) ----------
// Overlay completo (texto+imágenes) desde el canvas Fabric
function exportOverlayAllLocal(canvas, { multiplier = 2 } = {}) {
  try {
    const c = canvas || (typeof window !== "undefined" && window.doboDesignAPI?.getCanvas?.());
    if (!c || !c.toDataURL) return "";
    return c.toDataURL({ format: "png", multiplier, backgroundColor: "transparent" });
  } catch { return ""; }
}

// Oculta/rehabilita objetos por predicado (maneja grupos)
function maskCanvasByPredicate(canvas, predicate) {
  const hidden = [];
  const toggleChild = (g, keepChild) => {
    if (!g || !Array.isArray(g._objects)) return;
    for (const ch of g._objects) {
      const keep = keepChild(ch);
      if (!keep) { hidden.push(ch); ch.__wasVisible = ch.visible; ch.visible = false; }
    }
  };
  const hasKind = (o, kind) => {
    const isImg = o.type === "image";
    const isTxt = (o.type === "i-text" || o.type === "textbox" || o.type === "text");
    if (kind === "image" && isImg) return true;
    if (kind === "text"  && isTxt) return true;
    if (o.type === "group" && Array.isArray(o._objects)) {
      return o._objects.some(ch => hasKind(ch, kind));
    }
    return false;
  };
  canvas.getObjects().forEach(o => {
    const res = predicate(o, { hasKind });
    if (res === "children") {
      toggleChild(o, (ch) => predicate(ch, { hasKind }) === true);
    } else if (res !== true) {
      hidden.push(o); o.__wasVisible = o.visible; o.visible = false;
    }
  });
  canvas.requestRenderAll();
  return () => {
    hidden.forEach(o => { o.visible = (o.__wasVisible !== false); delete o.__wasVisible; });
    canvas.requestRenderAll();
  };
}

// --- SOLO IMAGEN / SOLO TEXTO (con invalidación de cache y grupos) ---
async function exportOnlyLocal(names = [], { multiplier = 2 } = {}) {
  try {
    const c = typeof window !== "undefined" ? window.doboDesignAPI?.getCanvas?.() : null;
    if (!c?.getObjects) return "";

    const wantImage = names.map(String).some(n => /image|imagen|plant|planta/i.test(n));
    const wantText  = names.map(String).some(n => /text|texto/i.test(n));
    const kind = wantImage ? "image" : wantText ? "text" : "";

    const isTxt = (o) => o?.type === "i-text" || o?.type === "textbox" || o?.type === "text" || typeof o?.text === "string";
    const isImg = (o) => o?.type === "image" || (!!o?._element && o._element.tagName === "IMG");

    const hidden = [];
    const hide = (o) => { if (!o) return; hidden.push(o); o.__wasVisible = o.visible; o.visible = false; markDirty(o); };

    // oculta lo que NO corresponda; respeta grupos/activeSelection
    (c.getObjects() || []).forEach(o => {
      const visit = (x) => {
        if (!x) return;
        if (x.type === "group" || x.type === "activeSelection") {
          (x._objects || []).forEach(visit);
          // si el grupo no tiene ningún hijo del tipo pedido, se oculta completo
          const keepAny = (x._objects || []).some(ch => (kind === "image" ? isImg(ch) : isTxt(ch)));
          if (!keepAny) hide(x);
          return;
        }
        const keep = (kind === "image" && isImg(x)) || (kind === "text" && isTxt(x));
        if (!keep) hide(x);
      };
      visit(o);
    });

    // fuerza render
    c.discardActiveObject?.();
    c.renderAll?.();

    const url = c.toDataURL({ format: "png", multiplier, backgroundColor: "transparent" });

    // restaurar
    hidden.forEach(o => { o.visible = (o.__wasVisible !== false); delete o.__wasVisible; markDirty(o); });
    c.renderAll?.();

    return url;
  } catch {
    return "";
  }
}

// --- LECTURA de URL de imagen desde tus productos (fallback de datos) ---
function readImageUrlFor(prod) {
  return (
    prod?.featuredImage?.url ||
    prod?.image?.url || prod?.image?.src ||
    (Array.isArray(prod?.images) && (prod.images[0]?.url || prod.images[0]?.src)) ||
    ""
  );
}

// --- Rehost CORS (convierte una URL remota en URL Cloudinary con CORS OK) ---
async function rehostForCORS(url) {
  if (!url) return "";
  try {
    const r = await fetch("/api/proxy-image", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    const j = await r.json().catch(() => ({}));
    return j?.url || "";
  } catch { return ""; }
}

// ---------- Preview INTEGRADO (maceta + planta + overlay) ----------
function selectStageEl(canvas) {
  const cEl = canvas?.lowerCanvasEl || canvas?.upperCanvasEl || null;
  return (
    document.querySelector("[data-stage-root]") ||
    cEl?.closest?.("[data-stage-root]") ||
    document.getElementById("dobo-stage") ||
    document.getElementById("design-stage") ||
    cEl?.parentElement || null
  );
}

// --- Dibujo tipo object-fit: contain ---
function drawContain(ctx, img, x, y, w, h) {
  const sx = w / img.naturalWidth;
  const sy = h / img.naturalHeight;
  const s = Math.min(sx || 1, sy || 1);
  const dw = (img.naturalWidth * s) | 0;
  const dh = (img.naturalHeight * s) | 0;
  const dx = x + ((w - dw) / 2) | 0;
  const dy = y + ((h - dh) / 2) | 0;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function pickImg(stageEl, role) {
  if (!stageEl) return null;
  const sels = role === "pot"
    ? ['[data-role="pot"] img','img[data-pot]','.pot img','img.pot','.pot-image','img[alt*="maceta" i]']
    : ['[data-role="plant"] img','img[data-plant]','.plant img','img.plant','.plant-image','img[alt*="planta" i]'];
  for (const s of sels) { const el = stageEl.querySelector(s); if (el) return el; }
  const imgs = stageEl.querySelectorAll("img");
  if (imgs.length === 0) return null;
  if (role === "pot") return imgs[0];
  if (role === "plant") return imgs.length > 1 ? imgs[1] : imgs[0];
  return null;
}

function stageRelativeRect(el, stageEl) {
  const er = el.getBoundingClientRect();
  const sr = stageEl.getBoundingClientRect();
  return { x: er.left - sr.left, y: er.top - sr.top, w: er.width, h: er.height };
}

function loadImageCORS(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

// --- Preview INTEGRADO (3 estrategias: DOM -> rehost -> datos) ---
async function exportIntegratedPreview({ stageEl, fabricCanvas, multiplier = 2, potUrl = "", plantUrl = "" } = {}) {
  try {
    const canvas = fabricCanvas || (typeof window !== "undefined" ? window.doboDesignAPI?.getCanvas?.() : null);
    const stage  = stageEl || (function selectStageEl(c) {
      const el = c?.lowerCanvasEl || c?.upperCanvasEl || null;
      return (
        document.querySelector("[data-stage-root]") ||
        el?.closest?.("[data-stage-root]") ||
        document.getElementById("dobo-stage") ||
        document.getElementById("design-stage") ||
        el?.parentElement || null
      );
    })(canvas);
    if (!canvas) return "";

    const W = Math.round(canvas.getWidth?.() || stage?.clientWidth || 800);
    const H = Math.round(canvas.getHeight?.() || stage?.clientHeight || 800);

    const out = document.createElement("canvas");
    out.width  = Math.max(1, Math.round(W * multiplier));
    out.height = Math.max(1, Math.round(H * multiplier));
    const ctx = out.getContext("2d");

    // ---------- Estrategia A: DOM con posiciones ----------
    const selImg = (root, role) => {
      if (!root) return null;
      const sels = role === "pot"
        ? ['[data-role="pot"] img','img[data-pot]','.pot img','img.pot','.pot-image','img[alt*="maceta" i]']
        : ['[data-role="plant"] img','img[data-plant]','.plant img','img.plant','.plant-image','img[alt*="planta" i]'];
      for (const s of sels) { const el = root.querySelector(s); if (el) return el; }
      const imgs = root.querySelectorAll("img");
      if (!imgs.length) return null;
      return role === "plant" ? (imgs.length > 1 ? imgs[1] : imgs[0]) : imgs[0];
    };

    let drewBase = false;
    async function drawDomImage(el) {
      if (!el) return false;
      const er = el.getBoundingClientRect();
      const sr = (stage || el.parentElement).getBoundingClientRect();
      const rx = (er.left - sr.left) * multiplier;
      const ry = (er.top  - sr.top ) * multiplier;
      const rw = (er.width)  * multiplier;
      const rh = (er.height) * multiplier;
      const src0 = el.currentSrc || el.src || "";
      try {
        const im = await (async () => {
          try {
            const im = new Image(); im.crossOrigin = "anonymous";
            await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = src0; });
            return im;
          } catch {
            const prox = await rehostForCORS(src0);
            if (!prox) throw new Error("rehost-failed");
            const im2 = new Image(); im2.crossOrigin = "anonymous";
            await new Promise((res, rej) => { im2.onload = res; im2.onerror = rej; im2.src = prox; });
            return im2;
          }
        })();
      ctx.drawImage(im, Math.round(rx), Math.round(ry), Math.round(rw), Math.round(rh));
      return true;
      } catch { return false; }
    }

    if (stage) {
      const potEl   = selImg(stage, "pot");
      const plantEl = selImg(stage, "plant");
      if (await drawDomImage(potEl))   drewBase = true;
      if (await drawDomImage(plantEl)) drewBase = true;
    }

    // ---------- Estrategia B: datos (si DOM falló) ----------
    if (!drewBase && (potUrl || plantUrl)) {
      const loadCORS = async (u) => {
        if (!u) return null;
        try {
          const im = new Image(); im.crossOrigin = "anonymous";
          await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = u; });
          return im;
        } catch {
          const prox = await rehostForCORS(u);
          if (!prox) return null;
          const im2 = new Image(); im2.crossOrigin = "anonymous";
          await new Promise((res, rej) => { im2.onload = res; im2.onerror = rej; im2.src = prox; });
          return im2;
        }
      };
      const [poti, plti] = await Promise.all([loadCORS(potUrl), loadCORS(plantUrl)]);
      if (poti) { drawContain(ctx, poti, 0, 0, out.width, out.height); drewBase = true; }
      if (plti) { drawContain(ctx, plti, 0, 0, out.width, out.height); drewBase = true; }
    }

    // ---------- Estrategia C: backgroundImage de Fabric ----------
    if (!drewBase && canvas?.backgroundImage) {
      try {
        const bi = canvas.backgroundImage.getElement?.() || canvas.backgroundImage._element;
        if (bi) { ctx.drawImage(bi, 0, 0, out.width, out.height); drewBase = true; }
      } catch {}
    }

    // Overlay encima (Fabric)
    if (typeof canvas?.toCanvasElement === "function") {
      const ov = canvas.toCanvasElement(multiplier);
      if (ov) ctx.drawImage(ov, 0, 0);
    } else if (canvas?.lowerCanvasEl) {
      ctx.save(); ctx.scale(multiplier, multiplier);
      ctx.drawImage(canvas.lowerCanvasEl, 0, 0);
      ctx.restore();
    }

    return out.toDataURL("image/png");
  } catch {
    return "";
  }
}

// Componer asunto del email: "DO 12345 · NO 67890" (fallback "DOBO")
function makeEmailSubject({ doNum, noNum }) {
  const L = [];
  if (doNum) L.push(`DO ${doNum}`);
  if (noNum) L.push(`NO ${noNum}`);
  return L.length ? L.join(" · ") : "DOBO";
}
// ===================== FIN HELPERS DOBO =====================






// al inicio del archivo, junto a otros useRef/useState
const initFromURLRef = { current: false };
const mobileShellRef = { current: null };

function ControlesPublicar() {
  const onPublish = async () => {
    const api = window.doboDesignAPI;
    const snap = api?.exportDesignSnapshot?.();
    if (!snap) { alert('No hay diseño'); return; }

    const canvas = api.getCanvas();
    const dataURL = exportPreviewDataURL(canvas, { multiplier: 2 });
    const attachment = await dataURLtoBase64Attachment(dataURL);

    const meta = { potHandle: 'maceta-x', plantHandle: 'planta-y', size: 'M' }; // ajusta con tus selecciones reales
    const designJSON = { ...snap, meta };

    const r = await fetch('/api/design/publish', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ designJSON, previewBase64: attachment, status: 'draft', tags: ['dobo','custom'] })
    });
    const out = await r.json();
    if (!r.ok) { alert(out.error || 'Error al publicar'); return; }
    console.log('Publicado:', out);
  };

  return <button className="btn btn-primary" onClick={onPublish}>Publicar diseño</button>;
}


// Dispara el email sin bloquear el checkout


/* ---------- tamaño: normalización de etiquetas ---------- */
function normalizeSizeTag(raw) {
  if (!raw) return "";
  const s = String(raw).trim().toLowerCase();
  if (s === "grande" || s === "g") return "Grande";
  if (s === "mediano" || s === "mediana" || s === "m") return "Mediano";
  if (s === "pequeño" || s === "pequeno" || s === "pequeña" || s === "pequena" || s === "perqueña" || s === "perquena" || s === "p")
    return "Pequeño";
  return "";
}
const getSizeTag = (tags = []) => {
  if (!Array.isArray(tags)) return "";
  for (const t of tags) {
    const n = normalizeSizeTag(t);
    if (n) return n;
  }
  return "";
};

/* ---------- precio ---------- */
const money = (amount, currency = "CLP") =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount || 0));
const num = (v) => Number(typeof v === "object" ? v?.amount : v || 0);
const firstVariantPrice = (p) => {
  const v = p?.variants?.[0]?.price;
  return v ? num(v) : num(p?.minPrice);
};
const productMin = (p) => num(p?.minPrice);

/* ---------- preview accesorios ---------- */
const escapeHtml = (s) =>
  (s && s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]))) || "";
const buildIframeHTML = (imgUrl, title, desc) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}body{margin:0;background:#fff;font-family:system-ui,sans-serif}
.wrap{padding:8px;display:flex;flex-direction:column;align-items:center;gap:8px}
img{max-width:100%;height:auto;display:block}
h4{margin:0;font-size:14px;font-weight:600;text-align:center}
p{margin:0;font-size:12px;line-height:1.35;text-align:center;color:#333}
</style></head><body><div class="wrap">
<img src="${escapeHtml(imgUrl)}" alt=""><h4>${escapeHtml(title||"")}</h4><p>${escapeHtml(desc||"")}</p>
</div></body></html>`;
function getPreviewRect() {
  if (typeof window === "undefined") return { w: 360, h: 360, centered: false };
  const m = window.innerWidth <= 768;
  const w = m ? Math.min(window.innerWidth - 24, 420) : 360;
  const h = m ? Math.min(Math.floor(window.innerHeight * 0.6), 520) : 360;
  return { w, h, centered: m };
}
function IframePreview(props) {
  if (!props.visible) return null;
  const d = getPreviewRect();
  const base = {
    position: "fixed",
    borderRadius: 12,
    overflow: "hidden",
    background: "#fff",
    boxShadow: "0 12px 32px rgba(0,0,0,.24)",
    zIndex: 9999,
    pointerEvents: "none",
  };
  const style = d.centered
    ? { ...base, left: "50%", bottom: 12, transform: "translateX(-50%)", width: d.w, height: d.h }
    : { ...base, left: props.x, top: props.y, width: d.w, height: d.h };
  return (
    <div style={style}>
      <iframe srcDoc={props.html} style={{ width: "100%", height: "100%", border: 0, pointerEvents: "none" }} />
    </div>
    
  );
}

/* ---------- dots ---------- */
function IndicatorDots({ count, current, onSelect, position = "bottom" }) {
  if (!count || count < 2) return null;
  return (
    <div className={`${styles.dots} ${position === "top" ? styles.dotsTop : styles.dotsBottom}`}>
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          className={`${styles.dot} ${i === current ? styles.dotActive : ""}`}
          aria-current={i === current ? "true" : "false"}
          onClick={() => onSelect(i)}
        />
      ))}
      <span className={styles.dotsLabel}>{current + 1}/{count}</span>
    </div>
   
  );
}

/* ---------- overlay ---------- */
const CustomizationOverlay = dynamic(() => import("../components/CustomizationOverlay"), { ssr: false });

/* ---------- swipe ---------- */
function makeSwipeEvents(swipeRef, handlers) {
  const begin = (x, y, id, el) => {
    swipeRef.current = { active: true, id, x, y };
    if (id != null && el?.setPointerCapture) el.setPointerCapture(id);
  };
  const end = (ev, el) => {
    const id = swipeRef.current?.id;
    if (id != null && el?.releasePointerCapture) el.releasePointerCapture(id);
    swipeRef.current = { active: false, id: null, x: 0, y: 0 };
  };
  const move = (x, y, ev, el) => {
    const s = swipeRef.current;
    if (!s?.active) return;
    const dx = x - s.x, dy = y - s.y;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      ev.preventDefault();
      if (Math.abs(dx) > 48) {
        dx > 0 ? handlers.prev() : handlers.next();
        end(ev, el);
      }
    }
  };
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

/* ---------- shop ---------- */
let SHOP_DOMAIN = process.env.NEXT_PUBLIC_SHOP_DOMAIN || "um7xus-0u.myshopify.com";
if (typeof window !== 'undefined') {
  const qs = new URLSearchParams(window.location.search);
  const fromQS = qs.get('shopDomain');
  if (fromQS) {
    SHOP_DOMAIN = fromQS;
  } else if (document.referrer) {
    try { SHOP_DOMAIN = new URL(document.referrer).host || SHOP_DOMAIN; } catch {}
  }
}


function Home() {
  const [plants, setPlants] = useState([]);
  const [pots, setPots] = useState([]);
  const [accessories, setAccessories] = useState([]);

  const [selectedPlantIndex, setSelectedPlantIndex] = useState(0);
  const [selectedPotIndex, setSelectedPotIndex] = useState(0);
  const [selectedPotVariant, setSelectedPotVariant] = useState(null);

  const [selectedAccessoryIndices, setSelectedAccessoryIndices] = useState([]);
  const [quantity, setQuantity] = useState(1);

  const [accPreview, setAccPreview] = useState({ visible: false, x: 0, y: 0, html: "" });

  const [selectedColor, setSelectedColor] = useState(null);
  const [colorOptions, setColorOptions] = useState([]);

  const [editing, setEditing] = useState(false);
  const [activeSize, setActiveSize] = useState("Grande"); // único selector de tamaño

  const zoomRef = useRef(0.5);
  const sceneWrapRef = useRef(null);
  const stageRef = useRef(null);
  const plantScrollRef = useRef(null);
  const potScrollRef = useRef(null);
  const plantSwipeRef = useRef({ active: false, id: null, x: 0, y: 0 });
  const potSwipeRef = useRef({ active: false, id: null, x: 0, y: 0 });

  const desiredPotHandleRef = useRef(null);
  const desiredPlantHandleRef = useRef(null);
  const desiredSizeRef = useRef(null);
  const [designMeta, setDesignMeta] = useState(null);   // <— NUEVO
  const restoredOnceRef = useRef(false);                // <— NUEVO
  const userPickedSizeRef = useRef(false);
  const appliedMetaOnceRef = useRef(false);

  // para clicks mitad-izq/der estilo Google Shopping
  const potDownRef = useRef({ btn: null, x: 0, y: 0 });
  const plantDownRef = useRef({ btn: null, x: 0, y: 0 });
  const CLICK_STEP_PX = 8;
  // DOBO: meta del diseño cargado
const designMetaRef = useRef(null);

  const handlePointerDownCap = (e, ref) => {
    ref.current = {
      btn: (e.pointerType === "mouse" || e.pointerType === "pen") ? e.button : 0,
      x: e.clientX ?? 0,
      y: e.clientY ?? 0,
    };
  };
  const handlePointerUpCap = (e, ref, handlers) => {
    if (editing) return;
    const d = ref.current || { btn: null, x: 0, y: 0 };
    if ((e.pointerType === "mouse" || e.pointerType === "pen") && d.btn !== 0) return;
    const dx = Math.abs((e.clientX ?? 0) - d.x);
    const dy = Math.abs((e.clientY ?? 0) - d.y);
    if (dx > CLICK_STEP_PX || dy > CLICK_STEP_PX) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX ?? 0) - rect.left;
    (x > rect.width / 2 ? handlers.next : handlers.prev)();
  };

  const COLOR_MAP = {
    negro:"#000000", blanco:"#ffffff", gris:"#808080", "gris claro":"#bfbfbf", "gris oscuro":"#4a4a4a", plomo:"#9ea2a2",
    plata:"#c0c0c0", dorado:"#d4af37", cobre:"#b87333",
    rojo:"#ff0000", burdeo:"#6d071a", vino:"#7b001c", rosado:"#ff7aa2", rosa:"#ff7aa2",
    naranjo:"#ff7a00", naranja:"#ff7a00", amarillo:"#ffd400",
    verde:"#00a65a", "verde oliva":"#6b8e23", oliva:"#6b8e23", menta:"#3eb489",
    azul:"#0066ff", celeste:"#4db8ff", turquesa:"#30d5c8",
    morado:"#7d3cff", lila:"#b57edc", lavanda:"#b497bd",
    café:"#6f4e37", marrón:"#6f4e37", cafe:"#6f4e37", chocolate:"#4e2a1e",
    beige:"#d9c6a5", crema:"#f5f0e6", hueso:"#f2efe6",
  };

  const _stripAccents = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const _norm = raw => _stripAccents(String(raw||'').toLowerCase().trim())
    .replace(/\s+/g,' ')
    .replace(/(claro|oscuro|mate|brillante|satinado|metalico|metalic|pastel)\b/g,'$1')
    .trim();

  const resolveColor = (opt) => {
    const raw = String((opt&&opt.hex) || opt || '').trim();
    if (/^#([0-9a-f]{3}){1,2}$/i.test(raw)) return raw;
    const key = _norm(raw);
    if (COLOR_MAP[key]) return COLOR_MAP[key];
    const parts = key.split(/[\/,-]/).map(s=>s.trim());
    for (const p of parts) if (COLOR_MAP[p]) return COLOR_MAP[p];
    return '#ccc';
  };

 useEffect(() => {
    if (typeof window !== "undefined" && window.fabric?.Image) {
      window.fabric.Image.prototype.crossOrigin = "anonymous";
    }
  }, []);
  
  useEffect(() => {
    const onFlag = (e) => setEditing(!!e.detail?.editing);
    window.addEventListener("dobo-editing", onFlag);
    return () => window.removeEventListener("dobo-editing", onFlag);
  }, []);
  useEffect(() => {
    const s = stageRef.current, c = sceneWrapRef.current;
    if (!s || !c) return;
    const ps = s.style.touchAction, pc = c.style.touchAction;
    s.style.touchAction = editing ? "none" : "pan-y";
    c.style.touchAction = editing ? "none" : "pan-y";
    return () => { s.style.touchAction = ps; c.style.touchAction = pc; };
  }, [editing]);

  // en el efecto de montaje inicial
useEffect(() => {
  const stage = stageRef.current;
  if (!stage) return;
  // expone el zoom inicial al CSS si usas --zoom
  stage.style.setProperty("--zoom", String(zoomRef.current));
}, []);

// Centrar horizontalmente el conjunto en móvil sin remaquetar
useEffect(() => {
  const shell = mobileShellRef?.current;
  if (!shell) return;
  const content = shell.querySelector('.container');
  if (!content) return;
  const center = () => {
    try {
      const target = Math.max(0, (content.scrollWidth - shell.clientWidth) / 2);
      shell.scrollLeft = target;
    } catch {}
  };
  center();
  const onR = () => center();
  window.addEventListener('resize', onR);
  return () => window.removeEventListener('resize', onR);
}, []);

// ---------- fetch por tamaño y tipo ----------
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const sizeQ = encodeURIComponent(activeSize); // "Pequeño" | "Mediano" | "Grande"
      const [rPots, rPlants, rAcc] = await Promise.all([
        fetch(`/api/products?size=${sizeQ}&type=maceta&first=60`, { cache: "no-store" }),
        fetch(`/api/products?size=${sizeQ}&type=planta&first=60`, { cache: "no-store" }),
        fetch(`/api/products?type=accesorio&first=60`, { cache: "no-store" }), // accesorios no dependen de tamaño
      ]);
      if (!rPots.ok) throw new Error(`pots HTTP ${rPots.status}`);
      if (!rPlants.ok) throw new Error(`plants HTTP ${rPlants.status}`);

      const dPots = await rPots.json();
      const dPlants = await rPlants.json();
      const dAcc = rAcc.ok ? await rAcc.json() : [];

      const potsList = Array.isArray(dPots) ? dPots : dPots.products || [];
      const plantsList = Array.isArray(dPlants) ? dPlants : dPlants.products || [];
      const accList = Array.isArray(dAcc) ? dAcc : dAcc.products || [];

      const norm = (list) =>
        list.map((p) => ({
          ...p,
          description: p?.description || p?.descriptionHtml || p?.body_html || "",
          descriptionHtml: p?.descriptionHtml || "",
          tags: Array.isArray(p?.tags) ? p.tags : [],
          variants: Array.isArray(p?.variants) ? p.variants : [],
          image: p?.image?.src || p?.image || (Array.isArray(p?.images) && p.images[0]?.src) || "",
          minPrice: p?.minPrice || { amount: 0, currencyCode: "CLP" },
        }));

      if (cancelled) return;

      const potsSafe = norm(potsList);
      const plantsSafe = norm(plantsList);
      const accSafe = norm(accList);

      setPots(potsSafe);
      setPlants(plantsSafe);
      setAccessories(accSafe);

      // 👉 IMPORTANTE: conservar selección (no resetear a 0 y no tocar selectedPotVariant aquí)
      setSelectedPotIndex((i) => Math.min(Math.max(i, 0), Math.max(potsSafe.length - 1, 0)));
      setSelectedPlantIndex((i) => Math.min(Math.max(i, 0), Math.max(plantsSafe.length - 1, 0)));
      userPickedSizeRef.current = false; // ya cargó la familia del tamaño nuevo

    } catch (err) {
      console.error("Error fetching products:", err);
      if (!cancelled) {
        setPlants([]);
        setPots([]);
        setAccessories([]);
      }
    }
  })();
  return () => { cancelled = true; };
}, [activeSize]);

// ---------- aplicar selección desde meta/query (una sola vez) ----------
const applyDesiredSelection = () => {
  if (restoredOnceRef.current) return;
  if (!Array.isArray(pots) || !Array.isArray(plants)) return;
  if (pots.length === 0 && plants.length === 0) return;

  const meta = designMeta || {};
  const q = new URLSearchParams(window.location.search);

  const wantSize  = (q.get('size')  || meta.size  || meta.tamano || meta.tamaño || '').toLowerCase();
  const wantPot   = (q.get('pot')   || q.get('potHandle')   || meta.potHandle   || meta.potTitle   || meta.potId   || '').toLowerCase();
  const wantPlant = (q.get('plant') || q.get('plantHandle') || meta.plantHandle || meta.plantTitle || meta.plantId || '').toLowerCase();

  const toStr = (v) => String(v || '').toLowerCase().trim();
  const gidToNum = (id) => {
    const s = String(id || '');
    return s.includes('gid://') ? s.split('/').pop() : s;
  };
  const findIdx = (arr, key) => {
    if (!key) return -1;
    const k = toStr(key);
    const kNum = gidToNum(k);
    return arr.findIndex(p => {
      const ids = [p?.id, gidToNum(p?.id), p?.handle, p?.title].map(toStr);
      return ids.includes(k) || ids.includes(toStr(kNum));
    });
  };

  let touched = false;

  // tamaño primero (esto re-dispara el fetch con la familia correcta)
  if (wantSize) {
    if (wantSize.startsWith('p')) { setActiveSize('Pequeño'); touched = true; }
    else if (wantSize.startsWith('m')) { setActiveSize('Mediano'); touched = true; }
    else if (wantSize.startsWith('g')) { setActiveSize('Grande'); touched = true; }
  }

  // maceta / planta
  const ip = findIdx(pots, wantPot);
  if (ip >= 0) { setSelectedPotIndex(ip); touched = true; }

  const il = findIdx(plants, wantPlant);
  if (il >= 0) { setSelectedPlantIndex(il); touched = true; }

  // color
  if (meta.color) { setSelectedColor(meta.color); touched = true; }

  if (touched) restoredOnceRef.current = true; // no repetir
};

// Ejecuta cuando ya hay productos o cambia la meta
useEffect(() => {
  applyDesiredSelection();
}, [pots, plants, designMeta]);



// DOBO: aplica selección de planta/maceta/color/size desde meta
useEffect(() => {
  // Solo una vez y solo si hay meta
  if (appliedMetaOnceRef.current) return;
  const meta = designMetaRef.current;
  if (!meta) return;
  if (!pots.length || !plants.length) return;

  const asStr = v => String(v || "").toLowerCase().trim();
  const gidToNum = (id) => (String(id||"").includes("gid://") ? String(id).split("/").pop() : String(id||""));

  const matchIndex = (list, target) => {
    if (!target) return -1;
    const t = asStr(target); const tNum = asStr(gidToNum(target));
    return list.findIndex(p => {
      const ids = [
        p?.id, gidToNum(p?.id), p?.handle, p?.title
      ].map(asStr);
      return ids.includes(t) || ids.includes(tNum);
    });
  };

  // Tamaño guardado en meta → solo si el usuario AÚN no eligió manualmente
  const sizeRaw = meta.size || meta.tamano || meta.tamaño;
  if (!userPickedSizeRef.current && sizeRaw) {
    const s = asStr(sizeRaw);
    if (["p","pequeño","pequeno","pequeña","pequena"].includes(s)) setActiveSize("Pequeño");
    else if (["m","mediano","mediana"].includes(s)) setActiveSize("Mediano");
    else if (["g","grande"].includes(s)) setActiveSize("Grande");
  }

  // Selección de maceta/planta si existen en la lista actual
  const ip = matchIndex(pots,   meta.potId || meta.pot || meta.potHandle || meta.potTitle);
  const il = matchIndex(plants, meta.plantId || meta.plant || meta.plantHandle || meta.plantTitle);
  if (ip >= 0) setSelectedPotIndex(ip);
  if (il >= 0) setSelectedPlantIndex(il);

  if (meta.color) setSelectedColor(meta.color);

  // ¡No volver a aplicar!
  appliedMetaOnceRef.current = true;
}, [pots, plants]);




  /* ---------- zoom rueda ---------- */
  useEffect(() => {
    const container = sceneWrapRef.current, stage = stageRef.current;
    if (!container || !stage) return;
    zoomRef.current = zoomRef.current || 1;
    stage.style.setProperty("--zoom", String(zoomRef.current));
    const MIN = 0.5, MAX = 2.5;
    let target = zoomRef.current, raf = 0;
    const clamp = (v) => Math.min(MAX, Math.max(MIN, v));
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        stage.style.setProperty("--zoom", String(target));
        container.style.setProperty("--zoom", String(target));
      });
    };
    const onWheel = (e) => {
      if (!stage.contains(e.target)) return;
      e.preventDefault();
      const step = e.deltaY > 0 ? -0.08 : 0.08;
      zoomRef.current = clamp(zoomRef.current + step);
      target = zoomRef.current;
      schedule();
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

// ---------- RESTAURAR SELECCIÓN (una sola vez) desde meta o query ----------
const restoredRef = useRef(false);
useEffect(() => {
  if (restoredRef.current) return;
  if (!Array.isArray(pots) || !Array.isArray(plants)) return;
  if (pots.length === 0 && plants.length === 0) return;

  const meta = designMetaRef.current || {};
  const q = new URLSearchParams(window.location.search);

  const wantSize  = (q.get('size')  || meta.size  || meta.tamano || meta.tamaño || '').toLowerCase();
  const wantPot   = (q.get('pot')   || q.get('potHandle')   || meta.potHandle   || meta.potTitle   || meta.potId   || '').toLowerCase();
  const wantPlant = (q.get('plant') || q.get('plantHandle') || meta.plantHandle || meta.plantTitle || meta.plantId || '').toLowerCase();

  // tamaño
  if (wantSize) {
    if (wantSize.startsWith('p')) setActiveSize('Pequeño');
    else if (wantSize.startsWith('m')) setActiveSize('Mediano');
    else if (wantSize.startsWith('g')) setActiveSize('Grande');
  }

  // helper
  const toStr = (v) => String(v || '').toLowerCase().trim();
  const gidToNum = (id) => {
    const s = String(id || '');
    return s.includes('gid://') ? s.split('/').pop() : s;
  };
  const findIdx = (arr, key) => {
    if (!key) return -1;
    const k = toStr(key);
    const kNum = gidToNum(k);
    return arr.findIndex(p => {
      const ids = [
        p?.id, gidToNum(p?.id), p?.handle, p?.title
      ].map(toStr);
      return ids.includes(k) || ids.includes(toStr(kNum));
    });
  };

  // maceta / planta
  const ip = findIdx(pots, wantPot);
  if (ip >= 0) setSelectedPotIndex(ip);

  const il = findIdx(plants, wantPlant);
  if (il >= 0) setSelectedPlantIndex(il);

  // color (opcional)
  if (meta.color) setSelectedColor(meta.color);

  restoredRef.current = true;
}, [pots, plants]);

  
  /* ---------- variantes: SOLO color ---------- */
  useEffect(() => {
    const pot = pots[selectedPotIndex];
    if (!pot) { setColorOptions([]); setSelectedPotVariant(null); return; }
    const valid = (pot.variants || []).filter((v) => !!v.image);
    const lower = (s) => (s ?? "").toString().trim().toLowerCase();
    const colors = [...new Set(valid.flatMap((v) => (v.selectedOptions || []).filter((o) => lower(o.name) === "color").map((o) => o.value)))];
    setColorOptions(colors);
    const match = (v, c) => {
      const opts = v.selectedOptions || [];
      return c ? opts.some((o) => lower(o.name) === "color" && lower(o.value) === lower(c)) : true;
    };
    if (!(selectedColor && valid.some((v) => match(v, selectedColor)))) {
      const first = colors.find((c) => valid.some((v) => match(v, c)));
      if (first) setSelectedColor(first);
    }
    const chosen = valid.find((v) => match(v, selectedColor)) || valid[0] || null;
    setSelectedPotVariant(chosen || null);
  }, [pots, selectedPotIndex, selectedColor]);

  /* ---------- totales ---------- */
  const getTotalPrice = () => {
    const pot = pots[selectedPotIndex];
    const plant = plants[selectedPlantIndex];
    const potPrice = selectedPotVariant?.price ? num(selectedPotVariant.price) : firstVariantPrice(pot);
    const plantPrice = productMin(plant);
    const accTotal = selectedAccessoryIndices.reduce((s, i) => {
      const a = accessories[i];
      const v = a?.variants?.[0]?.price;
      return s + (v ? num(v) : productMin(a));
    }, 0);
    return potPrice + plantPrice + accTotal;
  };
  const getTotalComparePrice = () => {
    const pot = pots[selectedPotIndex];
    const plant = plants[selectedPlantIndex];
    const potCmp = selectedPotVariant?.compareAtPrice ? num(selectedPotVariant.compareAtPrice) :
                    selectedPotVariant?.price ? num(selectedPotVariant.price) : firstVariantPrice(pot);
    const plantCmp = productMin(plant);
    const accCmp = selectedAccessoryIndices.reduce((s, i) => {
      const a = accessories[i];
      const base = a?.variants?.[0]?.compareAtPrice ?? a?.variants?.[0]?.price ?? a?.minPrice;
      return s + num(base);
    }, 0);
    return potCmp + plantCmp + accCmp;
  };

  /* ---------- cart helpers ---------- */
  const gidToNumeric = (id) => {
    const s = String(id || "");
    return s.includes("gid://") ? s.split("/").pop() : s;
  };
  async function captureDesignPreview() {
    const el = stageRef?.current;
    if (!el) return null;
    const { default: html2canvas } = await import("html2canvas");
    const onclone = (doc) => {
      const st = doc.querySelector('[data-capture-stage="1"]') || doc.body;
      st.style.overflow = "visible";
      st.style.clipPath = "none";
      const prune = (sel, keep) => {
        const tr = doc.querySelector(sel);
        if (!tr) return;
        Array.from(tr.children).forEach((node, i) => { if (i !== keep) node.remove(); });
        tr.style.transform = "none";
        tr.style.width = "100%";
      };
      prune('[data-capture="pot-track"]', selectedPotIndex);
      prune('[data-capture="plant-track"]', selectedPlantIndex);
      ['[data-capture="pot-container"]', '[data-capture="plant-container"]'].forEach((sel) => {
        const c = doc.querySelector(sel);
        if (c) { c.style.overflow = "visible"; c.style.clipPath = "none"; }
      });
    };
    const canvas = await html2canvas(el, { backgroundColor: "#eeeaeaff", scale: 3, useCORS: true, onclone });
    return canvas.toDataURL("image/png");
  }
  async function prepareDesignAttributes() {
    let previewUrl = "";
    try {
      const dataUrl = await captureDesignPreview();
      if (dataUrl) {
        const resp = await fetch("/api/upload-design", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json?.error || "Error al subir preview");
        previewUrl = json.url || "";
      }
    } catch {}
    const pot = pots[selectedPotIndex];
    const plant = plants[selectedPlantIndex];
    return [
      { key: "_DesignPreview", value: previewUrl },
      { key: "_DesignId", value: String(Date.now()) },
      { key: "_DesignPlant", value: plant?.id || "" },
      { key: "_DesignPot", value: pot?.id || "" },
      { key: "_DesignColor", value: selectedColor || "" },
      { key: "_DesignSize", value: activeSize || "" },
      { key: "_LinePriority", value: "0" },
    ];
  }

async function publishDesignForVariant(variantId) {
  try {
    const api = await waitDesignerReady(20000);
    if (!api) return { ok:false, error:'designer-not-ready' };

    // snapshot
    let snap = (
      api.exportDesignSnapshot?.() ??
      api.exportSnapshot?.() ??
      api.exportJSON?.() ??
      api.toJSON?.() ??
      api.getState?.()
    );
    if (!snap && typeof loadLocalDesign === 'function') snap = loadLocalDesign();
    if (!snap) return { ok:false, error:'no-snapshot' };

    // preview
    let previewDataURL = null;
    try { previewDataURL = await captureDesignPreview(); } catch {}
    if (!previewDataURL) {
      const canvas = api.getCanvas?.() || api.canvas || document.querySelector('canvas');
      try { previewDataURL = canvas?.toDataURL?.('image/png') || null; } catch {}
    }
    if (!previewDataURL) return { ok:false, error:'no-preview' };


// DOBO: meta para restaurar selección
const meta = {
  potId: pots[selectedPotIndex]?.id || "",
  potTitle: pots[selectedPotIndex]?.title || "",
  potHandle: pots[selectedPotIndex]?.handle || "",
  plantId: plants[selectedPlantIndex]?.id || "",
  plantTitle: plants[selectedPlantIndex]?.title || "",
  plantHandle: plants[selectedPlantIndex]?.handle || "",
  color: selectedColor || "",
  size: activeSize || ""
};

    
    // call
    const r = await fetch('/api/publish-by-variant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
  variantId,
  previewDataURL,
  design: snap,   // el snapshot actual
  meta            // ← importante
})
    });

    const raw = await r.text();
    let j; try { j = JSON.parse(raw); } catch { j = { ok:false, error: raw } }

    if (!r.ok || !j?.ok) {
      const msg = j?.error ? `${j.error}${j.stage ? ' @'+j.stage : ''}` : `HTTP ${r.status}`;
      return { ok:false, error: msg };
    }
    return j;
  } catch (e) {
    return { ok:false, error:String(e?.message||e) };
  }
}


async function getPreviewDataURL(api) {
  // usa tu helper existente
  try {
    const d = await captureDesignPreview();
    if (d) return d;
  } catch {}
  // fallback directo al canvas
  const canvas = api.getCanvas?.() || api.canvas || document.querySelector('canvas');
  try { return canvas?.toDataURL ? canvas.toDataURL('image/png') : null; } catch { return null; }
}

async function waitDesignerReady(timeout = 20000) {
  // 1) evento opcional si tu customizador lo emite
  let api = null;
  let resolved = false;
  const onEvt = (e)=>{ api = (e && e.detail) || window.doboDesignAPI; resolved = true; };
  window.addEventListener('dobo:ready', onEvt, { once:true });

  // 2) sondeo
  const start = Date.now();
  while (Date.now() - start < timeout && !resolved) {
    const a = window.doboDesignAPI;
    const ok = a && (a.exportDesignSnapshot || a.exportSnapshot || a.exportJSON || a.toJSON || a.getState);
    if (ok) { api = a; break; }
    await new Promise(r => setTimeout(r, 100));
  }
  window.removeEventListener('dobo:ready', onEvt);
  return api || null;
}



  







// —————————————————————————————————————————————
// POST AL CARRITO (mantiene compat de keys)
// —————————————————————————————————————————————
function postCart(shop, mainVariantId, qty, attrs, accessoryIds, returnTo) {
  const asStr = (v) => String(v || "").trim();
  const isNum = (v) => /^\d+$/.test(asStr(v));
  const gidToNum = (id) => {
    const s = asStr(id);
    return s.includes("gid://") ? s.split("/").pop() : s;
  };

  const main = isNum(mainVariantId) ? asStr(mainVariantId) : gidToNum(mainVariantId);
  if (!isNum(main)) throw new Error("Variant principal inválido");

  const accs = (accessoryIds || [])
    .map((id) => (isNum(id) ? asStr(id) : gidToNum(id)))
    .filter(isNum);

  const form = document.createElement("form");
  form.method = "POST";
  form.target = "_top";
  form.action = `https://${shop}/cart/add`;

  const add = (n, v) => {
    const i = document.createElement("input");
    i.type = "hidden";
    i.name = n;
    i.value = String(v);
    form.appendChild(i);
  };

  let line = 0;

  const getA = (name) => {
    const n = String(name || "").toLowerCase();
    return (attrs || []).find((a) => {
      const k = String(a?.key || "").toLowerCase();
      return k === n || k === `_${n}`;
    })?.value || "";
  };

  const previewUrl  = getA("DesignPreview");
  const designId    = getA("DesignId");
  const designPlant = getA("DesignPlant");
  const designPot   = getA("DesignPot");
  const designColor = getA("DesignColor");
  const designSize  = getA("DesignSize");
  const layerImg    = getA("Layer:Image") || getA("LayerImage") || getA("_LayerImage");
  const layerTxt    = getA("Layer:Text")  || getA("LayerText")  || getA("_LayerText");

  // Línea principal
  add(`items[${line}][id]`, main);
  add(`items[${line}][quantity]`, String(qty || 1));
  add(`items[${line}][properties][_LinePriority]`, "0");
  if (previewUrl)  add(`items[${line}][properties][_DesignPreview]`, previewUrl);
  if (designId)    add(`items[${line}][properties][_DesignId]`, designId);
  if (designPlant) add(`items[${line}][properties][_DesignPlant]`, designPlant);
  if (designPot)   add(`items[${line}][properties][_DesignPot]`, designPot);
  if (designColor) add(`items[${line}][properties][_DesignColor]`, designColor);
  if (designSize)  add(`items[${line}][properties][_DesignSize]`, designSize);
  if (layerImg)    add(`items[${line}][properties][_LayerImage]`, layerImg);
  if (layerTxt)    add(`items[${line}][properties][_LayerText]`, layerTxt);
  line++;

  // Accesorios (si hay)
  accs.forEach((id) => {
    add(`items[${line}][id]`, id);
    add(`items[${line}][quantity]`, "1");
    add(`items[${line}][properties][_Accessory]`, "true");
    add(`items[${line}][properties][_LinePriority]`, "1");
    line++;
  });

  if (returnTo) add("return_to", returnTo);
  document.body.appendChild(form);
  form.submit();
}

// —————————————————————————————————————————————
// ACCESORIOS (corrige gidToNumeric → gidToNum)
// —————————————————————————————————————————————
const getAccessoryVariantIds = () =>
  (selectedAccessoryIndices || [])
    .map((i) => accessories?.[i]?.variants?.[0]?.id)
    .map((id) => {
      const s = String(id || "");
      return s.includes("gid://") ? s.split("/").pop() : s;
    })
    .filter((id) => /^\d+$/.test(id));


// === DOBO Cloudinary Upload + Checkout seguro ===
const handleCheckout = async (mode = "checkout") => {
  try {
    const api = window.doboDesignAPI;
    if (!api || !api.toPNG) {
      alert("El diseñador no está listo. Intenta de nuevo en unos segundos.");
      return;
    }

    // Genera el PNG comprimido
    const dataUrl = api.toPNG(1.8); // menor multiplicador = imagen más liviana
    const blob = await (await fetch(dataUrl)).blob();

    // Prepara datos para subir a Cloudinary
    const formData = new FormData();
    formData.append("file", blob);
    formData.append("upload_preset", "dobo_uploads"); // tu preset configurado en Cloudinary

    // 🔹 Sube el archivo
    const uploadResponse = await fetch(
      "https://api.cloudinary.com/v1_1/dmebjfbwd/image/upload", // cambia por tu cloud name si difiere
      { method: "POST", body: formData }
    );
    const uploadData = await uploadResponse.json();

    if (!uploadData.secure_url) {
      console.error("Error al subir imagen:", uploadData);
      alert("No se pudo subir la imagen del diseño. Intenta de nuevo.");
      return;
    }

    console.log("[DOBO] Imagen subida correctamente:", uploadData.secure_url);

    // 🔹 Envía al backend para generar checkout y correo
    const res = await fetch("/api/createCheckout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        designUrl: uploadData.secure_url, // <-- ya no se manda el base64 pesado
        mode,
        ...selectedProductData, // tus datos actuales de producto
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error en checkout:", text);
      alert("No se pudo iniciar el checkout. Revisa la consola para más detalles.");
      return;
    }

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url; // redirige al checkout de Shopify
    } else {
      console.warn("No se recibió URL de checkout:", data);
      alert("No se pudo iniciar el checkout correctamente.");
    }
  } catch (err) {
    console.error("[DOBO] Error general en handleCheckout:", err);
    alert("Hubo un error inesperado al procesar tu compra.");
  }
};


// —————————————————————————————————————————————
// BUY NOW (normaliza https una sola vez y fuerza _DesignPreview)
// —————————————————————————————————————————————
async function buyNow() {
  try {
    let attrs = await prepareDesignAttributes(); // aquí ya llega _DesignPreview integrado por html2canvas

    // Esperar editor y canvas
    const ready = await waitDesignerReady(20000);
    if (!ready) throw new Error("designer-not-ready");
    const fabricCanvas = window.doboDesignAPI?.getCanvas?.() || null;
    if (!fabricCanvas) throw new Error("canvas-missing");

    const potUrl   = readImageUrlFor(pots?.[selectedPotIndex]);
    const plantUrl = readImageUrlFor(plants?.[selectedPlantIndex]);

    // Utilidades locales
    const __delay = (ms)=> new Promise(r=>setTimeout(r, ms));
    const __size  = (s)=> (s || "").length;
    const __tooSmall = (d) => __size(d) < 2000;

    const __isTextLike  = (o) => !!o && (/text/i.test(o.type || "") || typeof o.text === "string");
    const __hasTextDeep = (o) => !!o && (__isTextLike(o) || (Array.isArray(o._objects) && o._objects.some(__hasTextDeep)));
    const __isBaseLike = (o) => {
      if (!o) return false;
      const tag = (o.name || o.id || o.doboKind || o.role || "").toLowerCase();
      return /(^(base|pot|maceta|plant|planta|bg|background)$)|(^|_|-)(pot|maceta|plant|planta|base|bg|background)(_|-|$)/.test(tag);
    };
    const __hasBaseDeep = (o) => !!o && (__isBaseLike(o) || (Array.isArray(o._objects) && o._objects.some(__hasBaseDeep)));

    const __hidden = [];
    const __hideIf = (pred) => {
      const walk = (o) => {
        if (!o) return;
        if (pred(o)) { __hidden.push(o); o.__vis = o.visible; o.visible = false; }
        if (Array.isArray(o._objects)) o._objects.forEach(walk);
      };
      (fabricCanvas.getObjects?.() || []).forEach(walk);
      if (fabricCanvas.backgroundImage && pred(fabricCanvas.backgroundImage)) {
        const bg = fabricCanvas.backgroundImage;
        __hidden.push(bg); bg.__vis = bg.visible; bg.visible = false;
      }
      fabricCanvas.requestRenderAll?.();
    };
    const __restoreAll = () => {
      __hidden.forEach(o => { o.visible = (o.__vis !== false); delete o.__vis; });
      __hidden.length = 0;
      fabricCanvas.requestRenderAll?.();
    };
    const __snap = (mult = 2) =>
      fabricCanvas.toDataURL({ format: "png", multiplier: mult, backgroundColor: null });

    const __loadImage = (url) => new Promise((res, rej) => {
      if (!url) return rej(new Error("no-url"));
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.onerror = (e) => rej(e);
      img.src = url;
    });
    const __composeFull = async ({ overlayAllUrl, potUrl, plantUrl }) => {
      const [overlayImg, potImg, plantImg] = await Promise.all([
        __loadImage(overlayAllUrl),
        potUrl ? __loadImage(potUrl).catch(()=>null) : Promise.resolve(null),
        plantUrl ? __loadImage(plantUrl).catch(()=>null) : Promise.resolve(null),
      ]);
      const W = overlayImg.naturalWidth  || overlayImg.width  || 1024;
      const H = overlayImg.naturalHeight || overlayImg.height || 1024;
      const off = document.createElement("canvas");
      off.width = W; off.height = H;
      const ctx = off.getContext("2d");
      if (potImg)   ctx.drawImage(potImg,   0, 0, W, H);
      if (plantImg) ctx.drawImage(plantImg, 0, 0, W, H);
      ctx.drawImage(overlayImg, 0, 0, W, H);
      return off.toDataURL("image/png");
    };

    // === Capturas ===
    await __delay(50);

    // Overlay:All (sin base)
    __hideIf((o) => __hasBaseDeep(o) || o === fabricCanvas.backgroundImage);
    let overlayAll = __snap(2);

    // Solo texto
    __restoreAll();
    __hideIf((o) => __hasBaseDeep(o) || o === fabricCanvas.backgroundImage);
    __hideIf((o) => !__hasTextDeep(o));
    let layerTxt = __snap(2);

    // Solo imagen
    __restoreAll();
    __hideIf((o) => __hasBaseDeep(o) || o === fabricCanvas.backgroundImage);
    __hideIf((o) => __hasTextDeep(o));
    let layerImg = __snap(2);

    // Intento de “re-compuesto” (por si hiciera falta)
    __restoreAll();
    let previewRecomposed = "";
    try { previewRecomposed = await __composeFull({ overlayAllUrl: overlayAll, potUrl, plantUrl }); }
    catch { previewRecomposed = __snap(2); }

    // Filtros de tamaño mínimo
    if (__tooSmall(layerTxt)) layerTxt = "";
    if (__tooSmall(layerImg) && overlayAll && !__tooSmall(overlayAll)) layerImg = overlayAll;

    // ——— AQUÍ VIENE EL CAMBIO CRÍTICO ———
    // Preferimos SIEMPRE el DesignPreview que vino del prepareDesignAttributes (html2canvas),
    // y NO lo sobreescribimos si ya existe y es válido.
    const previewFromPrepare = getAttrCI(attrs, "designpreview"); // _DesignPreview o DesignPreview
    const bestIntegrated = previewFromPrepare || previewRecomposed || overlayAll;

    // Subir a https lo que falte
    overlayAll                 = await ensureHttpsUrl(overlayAll, "overlay-all");
    layerImg                   = await ensureHttpsUrl(layerImg, "layer-image");
    layerTxt                   = layerTxt ? await ensureHttpsUrl(layerTxt, "layer-text") : "";
    const bestIntegratedHttps  = await ensureHttpsUrl(bestIntegrated, "preview-full");

    // Merge attrs SIN pisar el DesignPreview existente
    const pushKV = (k, v) => { if (v) attrs = [...attrs.filter(a => a.key !== k && a.key !== `_${k}`), { key: k, value: v }]; };
    if (!previewFromPrepare) {
      // si no venía, recién ahora escribimos DesignPreview
      pushKV("DesignPreview", bestIntegratedHttps);
    } else {
      // si ya venía bueno, lo respetamos y guardamos el alias por compat
      pushKV("Preview:Full", bestIntegratedHttps);
    }
    pushKV("Overlay:All",  overlayAll);
    pushKV("Layer:Image",  layerImg);
    pushKV("Layer:Text",   layerTxt);

    // Precio + producto temporal
    const potPrice   = selectedPotVariant?.price ? num(selectedPotVariant.price) : firstVariantPrice(pots[selectedPotIndex]);
    const plantPrice = productMin(plants[selectedPlantIndex]);
    const basePrice  = Number(((potPrice + plantPrice) * quantity).toFixed(2));

    const previewForProduct =
      previewFromPrepare || bestIntegratedHttps || overlayAll;

    const dpRes = await fetch("/api/design-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `DOBO ${plants[selectedPlantIndex]?.title} + ${pots[selectedPotIndex]?.title}`,
        previewUrl: previewForProduct,          // ← usar el integrado ya bueno
        price: basePrice,
        color: selectedColor || "Único",
        size:  activeSize   || "Único",
        designId: attrs.find((a) => a.key === "_DesignId")?.value,
        plantTitle: plants[selectedPlantIndex]?.title || "Planta",
        potTitle:   pots[selectedPotIndex]?.title   || "Maceta",
      }),
    });
    const dp = await dpRes.json();
    if (!dpRes.ok || !dp?.variantId) throw new Error(dp?.error || "No se creó el producto DOBO");

    // DO / NO
    const doNum = (attrs.find(a => a.key === "_DesignId")?.value || "").toString().slice(-8).toUpperCase();
    const noNum = (String(dp.variantId || "").includes("gid://") ? String(dp.variantId).split("/").pop() : String(dp.variantId));
    pushKV("_DO", doNum);
    pushKV("_NO", noNum);

    // Publicar assets
    const again = await waitDesignerReady(20000);
    if (!again) throw new Error("designer-not-ready");
    const pub = await publishDesignForVariant(dp.variantId);
    if (!pub?.ok) throw new Error(pub?.error || "publish failed");

    // Email (usar attrs tal cual, que ya contienen las 3 capas y el integrado)
    const shortDescription = (
      `DOBO ${plants?.[selectedPlantIndex]?.title ?? ""} + ` +
      `${pots?.[selectedPotIndex]?.title ?? ""} · ` +
      `${activeSize ?? ""} · ${selectedColor ?? ""}`
    ).replace(/\s+/g, " ").trim();

    const emailAttrs = attrs.slice();

    sendEmailNow({
      subject: makeEmailSubject({ doNum, noNum }),
      attrs: emailAttrs,
      meta: { Descripcion: shortDescription, Precio: basePrice },
      links: { Storefront: location.origin },
      attachPreviews: true,
      attachOverlayAll: true
    });

    // Checkout
    const accIds = getAccessoryVariantIds();
    postCart(SHOP_DOMAIN, dp.variantId, quantity, attrs, accIds, "/checkout");
  } catch (e) {
    alert(`No se pudo iniciar el checkout: ${e.message}`);
  }
}




// —————————————————————————————————————————————
// ADD TO CART (normaliza https una sola vez y fuerza _DesignPreview)
// —————————————————————————————————————————————
async function addToCart() {
  try {
    let attrs = await prepareDesignAttributes(); // ya trae _DesignPreview integrado

    const ready = await waitDesignerReady(20000);
    if (!ready) throw new Error("designer-not-ready");
    const fabricCanvas = window.doboDesignAPI?.getCanvas?.() || null;
    if (!fabricCanvas) throw new Error("canvas-missing");

    const potUrl   = readImageUrlFor(pots?.[selectedPotIndex]);
    const plantUrl = readImageUrlFor(plants?.[selectedPlantIndex]);

    // Utilidades locales (idénticas a buyNow)
    const __delay = (ms)=> new Promise(r=>setTimeout(r, ms));
    const __size  = (s)=> (s || "").length;
    const __tooSmall = (d) => __size(d) < 2000;
    const __isTextLike  = (o) => !!o && (/text/i.test(o.type || "") || typeof o.text === "string");
    const __hasTextDeep = (o) => !!o && (__isTextLike(o) || (Array.isArray(o._objects) && o._objects.some(__hasTextDeep)));
    const __isBaseLike = (o) => {
      if (!o) return false;
      const tag = (o.name || o.id || o.doboKind || o.role || "").toLowerCase();
      return /(^(base|pot|maceta|plant|planta|bg|background)$)|(^|_|-)(pot|maceta|plant|planta|base|bg|background)(_|-|$)/.test(tag);
    };
    const __hasBaseDeep = (o) => !!o && (__isBaseLike(o) || (Array.isArray(o._objects) && o._objects.some(__hasBaseDeep)));

    const __hidden = [];
    const __hideIf = (pred) => {
      const walk = (o) => {
        if (!o) return;
        if (pred(o)) { __hidden.push(o); o.__vis = o.visible; o.visible = false; }
        if (Array.isArray(o._objects)) o._objects.forEach(walk);
      };
      (fabricCanvas.getObjects?.() || []).forEach(walk);
      if (fabricCanvas.backgroundImage && pred(fabricCanvas.backgroundImage)) {
        const bg = fabricCanvas.backgroundImage;
        __hidden.push(bg); bg.__vis = bg.visible; bg.visible = false;
      }
      fabricCanvas.requestRenderAll?.();
    };
    const __restoreAll = () => {
      __hidden.forEach(o => { o.visible = (o.__vis !== false); delete o.__vis; });
      __hidden.length = 0;
      fabricCanvas.requestRenderAll?.();
    };
    const __snap = (mult = 2) =>
      fabricCanvas.toDataURL({ format: "png", multiplier: mult, backgroundColor: null });

    const __loadImage = (url) => new Promise((res, rej) => {
      if (!url) return rej(new Error("no-url"));
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.onerror = (e) => rej(e);
      img.src = url;
    });
    const __composeFull = async ({ overlayAllUrl, potUrl, plantUrl }) => {
      const [overlayImg, potImg, plantImg] = await Promise.all([
        __loadImage(overlayAllUrl),
        potUrl ? __loadImage(potUrl).catch(()=>null) : Promise.resolve(null),
        plantUrl ? __loadImage(plantUrl).catch(()=>null) : Promise.resolve(null),
      ]);
      const W = overlayImg.naturalWidth  || overlayImg.width  || 1024;
      const H = overlayImg.naturalHeight || overlayImg.height || 1024;
      const off = document.createElement("canvas");
      off.width = W; off.height = H;
      const ctx = off.getContext("2d");
      if (potImg)   ctx.drawImage(potImg,   0, 0, W, H);
      if (plantImg) ctx.drawImage(plantImg, 0, 0, W, H);
      ctx.drawImage(overlayImg, 0, 0, W, H);
      return off.toDataURL("image/png");
    };

    // === Capturas ===
    await __delay(50);

    __hideIf((o) => __hasBaseDeep(o) || o === fabricCanvas.backgroundImage);
    let overlayAll = __snap(2);

    __restoreAll();
    __hideIf((o) => __hasBaseDeep(o) || o === fabricCanvas.backgroundImage);
    __hideIf((o) => !__hasTextDeep(o));
    let layerTxt = __snap(2);

    __restoreAll();
    __hideIf((o) => __hasBaseDeep(o) || o === fabricCanvas.backgroundImage);
    __hideIf((o) => __hasTextDeep(o));
    let layerImg = __snap(2);

    __restoreAll();
    let previewRecomposed = "";
    try { previewRecomposed = await __composeFull({ overlayAllUrl: overlayAll, potUrl, plantUrl }); }
    catch { previewRecomposed = __snap(2); }

    if (__tooSmall(layerTxt)) layerTxt = "";
    if (__tooSmall(layerImg) && overlayAll && !__tooSmall(overlayAll)) layerImg = overlayAll;

    const previewFromPrepare = getAttrCI(attrs, "designpreview");
    const bestIntegrated = previewFromPrepare || previewRecomposed || overlayAll;

    overlayAll                = await ensureHttpsUrl(overlayAll, "overlay-all");
    layerImg                  = await ensureHttpsUrl(layerImg, "layer-image");
    layerTxt                  = layerTxt ? await ensureHttpsUrl(layerTxt, "layer-text") : "";
    const bestIntegratedHttps = await ensureHttpsUrl(bestIntegrated, "preview-full");

    const pushKV = (k, v) => { if (v) attrs = [...attrs.filter(a => a.key !== k && a.key !== `_${k}`), { key: k, value: v }]; };
    if (!previewFromPrepare) {
      pushKV("DesignPreview", bestIntegratedHttps);
    } else {
      pushKV("Preview:Full",  bestIntegratedHttps);
    }
    pushKV("Overlay:All",  overlayAll);
    pushKV("Layer:Image",  layerImg);
    pushKV("Layer:Text",   layerTxt);

    const potPrice   = selectedPotVariant?.price ? num(selectedPotVariant.price) : firstVariantPrice(pots[selectedPotIndex]);
    const plantPrice = productMin(plants[selectedPlantIndex]);
    const basePrice  = Number(((potPrice + plantPrice) * quantity).toFixed(2));

    const previewForProduct =
      previewFromPrepare || bestIntegratedHttps || overlayAll;

    const dpRes = await fetch("/api/design-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `DOBO ${plants[selectedPlantIndex]?.title} + ${pots[selectedPotIndex]?.title}`,
        previewUrl: previewForProduct,          // ← usar el integrado ya bueno
        price: basePrice,
        color: selectedColor || "Único",
        size:  activeSize   || "Único",
        designId: attrs.find((a) => a.key === "_DesignId")?.value,
        plantTitle: plants[selectedPlantIndex]?.title || "Planta",
        potTitle:   pots[selectedPotIndex]?.title   || "Maceta",
      }),
    });
    const dp = await dpRes.json();
    if (!dpRes.ok || !dp?.variantId) throw new Error(dp?.error || "No se creó el producto DOBO");

    const doNum = (attrs.find(a => a.key === "_DesignId")?.value || "").toString().slice(-8).toUpperCase();
    const noNum = (String(dp.variantId || "").includes("gid://") ? String(dp.variantId).split("/").pop() : String(dp.variantId));
    pushKV("_DO", doNum);
    pushKV("_NO", noNum);

    const again = await waitDesignerReady(20000);
    if (!again) throw new Error("designer-not-ready");
    const pub = await publishDesignForVariant(dp.variantId);
    if (!pub?.ok) throw new Error(pub?.error || "publish failed");

    const shortDescription = (
      `DOBO ${plants?.[selectedPlantIndex]?.title ?? ""} + ` +
      `${pots?.[selectedPotIndex]?.title ?? ""} · ` +
      `${activeSize ?? ""} · ${selectedColor ?? ""}`
    ).replace(/\s+/g, " ").trim();

    const emailAttrs = attrs.slice();

    sendEmailNow({
      subject: makeEmailSubject({ doNum, noNum }),
      attrs: emailAttrs,
      meta: { Descripcion: shortDescription, Precio: basePrice },
      links: { Storefront: location.origin },
      attachPreviews: true,
      attachOverlayAll: true
    });

    // Añadir al carrito
    const accIds = getAccessoryVariantIds();
    postCart(SHOP_DOMAIN, dp.variantId, quantity, attrs, accIds, "/cart");
  } catch (e) {
    alert(`No se pudo añadir: ${e.message}`);
  }
}







  /* ---------- handlers swipe ---------- */
  const createHandlers = (items, setIndex) => ({
    prev: () => setIndex((p) => (p > 0 ? p - 1 : Math.max(items.length - 1, 0))),
    next: () => setIndex((p) => (p < items.length - 1 ? p + 1 : 0)),
  });
  const plantHandlers = createHandlers(plants, setSelectedPlantIndex);
  const potHandlers = createHandlers(pots, setSelectedPotIndex);
  const plantSwipeEvents = makeSwipeEvents(plantSwipeRef, plantHandlers);
  const potSwipeEvents = makeSwipeEvents(potSwipeRef, potHandlers);

  /* ---------- UI ---------- */
  const baseCode = selectedPotVariant?.price?.currencyCode || "CLP";
  const totalNow = getTotalPrice() * quantity;
  const totalBase = getTotalComparePrice() * quantity;

// === DOBO loader desde ?designUrl ===
useEffect(() => {
  (async () => {
    const params = new URLSearchParams(window.location.search);
    const designUrl = params.get("designUrl");
    if (!designUrl) return;

    // esperar API del editor
    const wait = async (ms = 20000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        const a = window.doboDesignAPI;
        const ok = a && (a.importDesignSnapshot || a.loadDesignSnapshot || a.loadJSON || a.loadFromJSON);
        if (ok) return a;
        await new Promise(r => setTimeout(r, 100));
      }
      return null;
    };
    const api = await wait();
    if (!api) return;

    try {
      api?.reset?.();
      const resp = await fetch(designUrl, { cache: "no-store" });
      if (!resp.ok) return;
      const payload = await resp.json();
      const snapshot = payload?.design || payload;
// guarda meta para sincronizar carruseles
designMetaRef.current = payload?.meta || payload?.doboMeta || snapshot?.meta || null;
      setDesignMeta(designMetaRef.current); // <-- dispara efecto de restauración


      if (api.importDesignSnapshot) await api.importDesignSnapshot(snapshot);
      else if (api.loadDesignSnapshot) await api.loadDesignSnapshot(snapshot);
      else if (api.loadJSON) await api.loadJSON(snapshot);
      else if (api.loadFromJSON) {
        await new Promise(res => api.loadFromJSON(snapshot, () => { api.requestRenderAll?.(); res(); }));
      }
    } catch (e) {
      console.error("load designUrl failed", e);
    }
  })();
}, []);
// === /DOBO loader ===


  
  return (
<div className={`container mt-lg-3 mt-0 ${styles.container}`} style={{ paddingBottom: "150px" }}>



      <div className="row justify-content-center align-items-start gx-5 gy-4">
        <div className="col-lg-5 col-md-8 col-12 text-center">
          {/* Selector de tamaño */}
          <div className="btn-group mb-3" role="group" aria-label="Tamaño">
         {["Pequeño", "Mediano", "Grande"].map((s) => (
  <button
    key={s}
    className={`btn btn-sm ${activeSize === s ? "btn-dark" : "btn-outline-secondary"}`}
    onClick={() => {
      userPickedSizeRef.current = true;        // el usuario eligió
      appliedMetaOnceRef.current = true;       // no volver a aplicar meta luego
      setActiveSize(s);                        // dispara fetch por tamaño
    }}
  >
    {s}
  </button>
))}


          </div>

  {/* Escena */}
<div
  className="position-relative"
  ref={sceneWrapRef}
  style={{
    width: "100%",
    maxWidth: "500px",
    aspectRatio: "500 / 650",
    backgroundImage: "url('/images/fondo-dobo.jpg')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    border: "0px dashed #6c757d",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    touchAction: "pan-y",
    userSelect: "none",
  }}
>

  {/* Dots y flechas PLANTAS */}
  <IndicatorDots
    count={plants.length}
    current={selectedPlantIndex}
    onSelect={(i) =>
      setSelectedPlantIndex(Math.max(0, Math.min(i, plants.length - 1)))
    }
    position="top"
  />
  <button
    className={`${styles.chev} ${styles.chevTopLeft}`}
    aria-label="Anterior"
    onClick={() =>
      setSelectedPlantIndex((p) =>
        p > 0 ? p - 1 : Math.max(plants.length - 1, 0)
      )
    }
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  </button>
  <button
    className={`${styles.chev} ${styles.chevTopRight}`}
    aria-label="Siguiente"
    onClick={() =>
      setSelectedPlantIndex((p) =>
        p < plants.length - 1 ? p + 1 : 0
      )
    }
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6l6 6-6 6" />
    </svg>
  </button>

  {/* Dots y flechas MACETAS */}
  <IndicatorDots
    count={pots.length}
    current={selectedPotIndex}
    onSelect={(i) =>
      setSelectedPotIndex(Math.max(0, Math.min(i, pots.length - 1)))
    }
    position="bottom"
  />
  <button
    className={`${styles.chev} ${styles.chevBottomLeft}`}
    aria-label="Anterior"
    onClick={() =>
      setSelectedPotIndex((p) =>
        p > 0 ? p - 1 : Math.max(pots.length - 1, 0)
      )
    }
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  </button>
  <button
    className={`${styles.chev} ${styles.chevBottomRight}`}
    aria-label="Siguiente"
    onClick={() =>
      setSelectedPotIndex((p) =>
        p < pots.length - 1 ? p + 1 : 0
      )
    }
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6l6 6-6 6" />
    </svg>
  </button>

  {/* NODO ESCALADO + ALINEADO */}
  <div
    ref={stageRef}
    data-capture-stage="1"
    className="d-flex justify-content-center align-items-center"
    style={{
      height: "100%",
      "--zoom": 0.75,
      transform: "scale(var(--zoom))",
      transformOrigin: "50% 70%",
      willChange: "transform",
      backfaceVisibility: "hidden",
      touchAction: "pan-y",
      userSelect: "none",
      position: "relative",
      width: "100%",
    }}
  >

    {/* MACETA */}
    <div
      className={styles.carouselContainer}
      ref={potScrollRef}
      data-capture="pot-container"
      style={{
        zIndex: 2,
        position: "absolute",
        bottom: "0px",
        left: "50%",
        transform: "translateX(-50%)",
        transformOrigin: "top center", 
        touchAction: "pan-y",
        userSelect: "none",
      }}
      onPointerDownCapture={(e) => handlePointerDownCap(e, potDownRef)}
      onPointerUpCapture={(e) =>
        handlePointerUpCap(
          e,
          potDownRef,
          createHandlers(pots, setSelectedPotIndex)
        )
      }
      onAuxClick={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      {...potSwipeEvents}
    >
    <div
  className={styles.carouselTrack}
  data-capture="plant-track"
  style={{
    transform: `translateX(-${selectedPlantIndex * 100}%)`,
    transformOrigin: "bottom center"  // <-- PIVOTE ABAJO
  }}
>

        {pots.map((product, idx) => {
          const isSel = idx === selectedPotIndex;
          const vImg = isSel
            ? selectedPotVariant?.image || selectedPotVariant?.imageUrl || null
            : null;
          const imageUrl = vImg || product.image;
          return (
            <div key={product.id} className={styles.carouselItem}>
              <img src={imageUrl} alt={product.title} className={styles.carouselImage} />
            </div>
          );
        })}
      </div>
    </div>

    {/* PLANTA (ALINEADA SOBRE LA MACETA) */}
    <div
      className={styles.carouselContainer}
      ref={plantScrollRef}
      data-capture="plant-container"
      style={{
        zIndex: 3,
        position: "absolute",
        bottom: "360px",  // ← AJUSTE CLAVE: planta encima de maceta
        left: "50%",
        transform: "translateX(-50%)",
        transformOrigin: "bottom center",
        height: "530px",
        touchAction: "pan-y",
        userSelect: "none",
      }}
      onPointerDownCapture={(e) => handlePointerDownCap(e, plantDownRef)}
      onPointerUpCapture={(e) =>
        handlePointerUpCap(
          e,
          plantDownRef,
          createHandlers(plants, setSelectedPlantIndex)
        )
      }
      onAuxClick={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      {...plantSwipeEvents}
    >
     <div
  className={styles.carouselTrack}
  data-capture="pot-track"
  style={{
    transform: `translateX(-${selectedPotIndex * 100}%)`,
    transformOrigin: "top center"   // <-- PIVOTE ARRIBA
  }}
>

        {plants.map((product) => (
          <div key={product.id} className={styles.carouselItem}>
            <img
              src={product.image}
              alt={product.title}
              className={`${styles.carouselImage} ${styles.plantImageOverlay}`}
            />
          </div>
        ))}
      </div>
    </div>

  </div>
</div>

{/* Dock menú DOBO debajo de carruseles */}
<div id="dobo-menu-dock" className={styles.menuDock} />

       
        </div>

        {/* Overlay de edición (restaurado) */}
        <CustomizationOverlay mode="both" stageRef={stageRef} anchorRef={potScrollRef} containerRef={sceneWrapRef} docked={false} />

        {/* Panel derecho */}
        <div className="col-lg-5 col-md-8 col-12">
          {pots.length > 0 && plants.length > 0 && (
            <div className="text-center">
              <div className="d-flex justify-content-center align-items-baseline gap-3 mb-4" style={{ marginTop: 20 }}>
                {totalBase > totalNow && (
                  <p style={{ marginTop: 8, fontSize: "1.2rem", color: "#6c757d" }}>
                    <span style={{ textDecoration: "line-through" }}>{money(totalBase, baseCode)}</span>
                  </p>
                )}
                <span style={{ fontWeight: "bold", fontSize: "3rem" }}>{money(totalNow, baseCode)}</span>
              </div>

              {/* SOLO color */}
              {colorOptions.length > 0 && (
                <div className="mb-4">
                  <h5>Color</h5>
                  <div className="d-flex justify-content-center gap-3 flex-wrap">
                    {colorOptions.map((color, index) => {
                      const bg = resolveColor(color);
                      const isWhite = bg.toLowerCase() === "#ffffff" || bg.toLowerCase() === "#fff";
                      const isSelected = selectedColor === color;
                      return (
                        <div
                          key={index}
                          onClick={() => setSelectedColor(color)}
                          title={color}
                          aria-label={color}
                          aria-selected={isSelected}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            backgroundColor: bg,              // <- FIX: usar color real
                            border: isSelected ? "3px solid #000" : (isWhite ? "1px solid #999" : "1px solid #ccc"),
                            boxShadow: isSelected ? "0 0 0 3px rgba(0,0,0,0.15) inset" : "none",
                            cursor: "pointer",
                            transition: "transform .12s ease",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

   {/* Accesorios: bloque ORIGINAL tipo grilla con preview */}
          {accessories && accessories.length > 0 && (
            <div className="mb-4 mt-4">
              <h5>Accesorios</h5>
              <div className="d-flex justify-content-center gap-3 flex-wrap">
                {accessories.map((product, index) => {
                  const img =
                    product?.image?.src || product?.image ||
                    (Array.isArray(product?.images) && product.images[0]?.src) ||
                    "/placeholder.png";
                  const title = product?.title || product?.name || `Accesorio ${index + 1}`;
                  const selected = selectedAccessoryIndices.includes(index);
                  return (
                    <div
                      key={product?.id || index}
                      onClick={(e) => {
                        setSelectedAccessoryIndices((prev) =>
                          prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
                        );
                        const cx = typeof e?.clientX === "number" ? e.clientX : 0;
                        const cy = typeof e?.clientY === "number" ? e.clientY : 0;
                        setAccPreview({
                          visible: true,
                          x: cx + 16,
                          y: cy + 16,
                          html: buildIframeHTML(img, title, product?.description || product?.body_html || ""),
                        });
                      }}
                      onMouseEnter={(e) => {
                        const cx = typeof e?.clientX === "number" ? e.clientX : 0;
                        const cy = typeof e?.clientY === "number" ? e.clientY : 0;
                        setAccPreview({
                          visible: true,
                          x: cx + 16,
                          y: cy + 16,
                          html: buildIframeHTML(img, title, product?.description || product?.body_html || ""),
                        });
                      }}
                      onMouseMove={(e) =>
                        setAccPreview((p) => (p.visible ? { ...p, x: e.clientX + 16, y: e.clientY + 16 } : p))
                      }
                      onMouseLeave={() => setAccPreview((p) => ({ ...p, visible: false }))}
                      aria-label={title}
                      style={{
                        border: selected ? "3px solid black" : "1px solid #ccc",
                        borderRadius: "12px",
                        padding: "6px",
                        cursor: "zoom-in",
                        width: "100px",
                        height: "100px",
                        overflow: "hidden",
                        transition: "transform 0.2s ease",
                      }}
                    >
                      <img src={img} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "6px" }} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

              {/* Cantidad + botones */}
              <div className="d-flex flex-column align-items-center mb-5">
                <div className="mb-3 text-center">
                  <label className="form-label d-block">Cantidad</label>
                  <div className="input-group justify-content-center" style={{ maxWidth: 200, margin: "0 auto" }}>
                    <button className="btn btn-outline-secondary" onClick={() => setQuantity((p) => Math.max(1, p - 1))}>-</button>
                    <input
                      type="number"
                      className="form-control text-center"
                      value={quantity}
                      min="1"
                      max="1000"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d*$/.test(val)) {
                          const n = parseInt(val, 10);
                          if (!isNaN(n) && n >= 1 && n <= 1000) setQuantity(n);
                          else if (val === "") setQuantity("");
                        }
                      }}
                      onBlur={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (isNaN(n) || n < 1) setQuantity(1);
                        else if (n > 1000) setQuantity(1000);
                      }}
                    />
                    <button className="btn btn-outline-secondary" onClick={() => setQuantity((p) => Math.min(1000, p + 1))}>+</button>
                  </div>
                </div>

                <div className="d-flex gap-3">
                  <button className="btn btn-outline-dark px-4 py-2" onClick={addToCart}>Añadir al carro</button>
                  <button className="btn btn-dark px-4 py-2" onClick={buyNow}>Comprar ahora</button>
                </div>
              </div>
            </div>
          )}

          {/* Descripciones */}
          <div className="text-start px-3 mb-4" style={{ maxWidth: 500, margin: "0 auto" }}>
            <h6><strong>Planta</strong></h6>
            {(() => {
              const p = plants[selectedPlantIndex];
              const html = p?.descriptionHtml;
              const d = p?.description;
              return html ? (
                <div style={{ fontSize: "1.2rem" }} dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                <p style={{ fontSize: "1.2rem" }}>{d || "Descripción no disponible."}</p>
              );
            })()}

            <h6 className="mt-3"><strong>Maceta</strong></h6>
            {(() => {
              const p = pots[selectedPotIndex];
              const html = p?.descriptionHtml;
              const d = p?.description;
              return html ? (
                <div style={{ fontSize: "1.2rem" }} dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                <p style={{ fontSize: "1.2rem" }}>{d || "Descripción no disponible."}</p>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Preview flotante accesorios */}
      <IframePreview
        visible={accPreview.visible}
        x={accPreview.x}
        y={accPreview.y}
        html={accPreview.html}
        onClose={() => setAccPreview((p) => ({ ...p, visible: false }))}
      />

      <style jsx global>{`
        .pot-carousel--locked { pointer-events: none; user-select: none; -webkit-user-drag: none; touch-action: none; overflow: hidden !important; scrollbar-width: none; }
        .pot-carousel--locked::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );

}
export default dynamic(() => Promise.resolve(Home), { ssr: false });
