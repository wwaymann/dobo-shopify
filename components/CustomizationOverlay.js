// components/CustomizationOverlay.js
// DOBO - CustomizationOverlay (Nov 2025) - plano (sin relieve), vectorización con “Detalles”
// Español neutro. No cambia lo que ya funciona, solo corrige y extiende según solicitud.

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { createPortal } from "react-dom";
import HistoryManager from "../lib/history";

// ======= Constantes =======
const Z_CANVAS = 4000;
const FONT_OPTIONS = [
  { name: "Arial", css: 'Arial, Helvetica, sans-serif' },
  { name: "Georgia", css: 'Georgia, serif' },
  { name: "Times New Roman", css: '"Times New Roman", Times, serif' },
  { name: "Courier New", css: '"Courier New", Courier, monospace' },
  { name: "Trebuchet MS", css: '"Trebuchet MS", Tahoma, sans-serif' },
  { name: "Montserrat", css: 'Montserrat, Arial, sans-serif' },
  { name: "Poppins", css: 'Poppins, Arial, sans-serif' },
];

const VECTOR_SAMPLE_DIM = 500;
const MAX_TEXTURE_DIM = 1600;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function hexToRgb(hex) {
  const m = String(hex || "").replace("#", "").match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return [51, 51, 51];
  let s = m[1];
  if (s.length === 3) s = s.split("").map(ch => ch + ch).join("");
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ======= Otsu =======
function otsuThreshold(gray, total) {
  if (!gray || !total || total <= 0) return 127;
  const hist = new Uint32Array(256);
  for (let i = 0; i < total; i++) hist[gray[i]]++;

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0, wB = 0;
  let varMax = -1;
  let threshold = 127;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const diff = mB - mF;
    const between = wB * wF * diff * diff;

    if (Number.isFinite(between) && between > varMax) {
      varMax = between;
      threshold = t;
    }
  }
  return threshold;
}

function downscale(imgEl) {
  const w = imgEl.naturalWidth || imgEl.width;
  const h = imgEl.naturalHeight || imgEl.height;
  const r = Math.min(MAX_TEXTURE_DIM / w, MAX_TEXTURE_DIM / h, 1);
  if (!w || !h || r === 1) return imgEl;
  const cw = Math.round(w * r), ch = Math.round(h * r);
  const cv = document.createElement("canvas");
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imgEl, 0, 0, cw, ch);
  return cv;
}

// ======= Vectorización (igual sistema usado antes: binarización con “Detalles/vecBias” y color) =======
function vectorizeElementToBitmap(element, opts = {}) {
  const {
    maxDim = VECTOR_SAMPLE_DIM,
    makeDark = true,
    drawColor = [51, 51, 51],
    thrBias = 0
  } = opts;

  const iw = element?.width, ih = element?.height;
  if (!iw || !ih) return null;

  const scale = (iw > ih) ? maxDim / iw : maxDim / ih;
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));

  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(element, 0, 0, w, h);

  let img;
  try {
    img = ctx.getImageData(0, 0, w, h);
  } catch {
    return null;
  }

  const data = img?.data;
  const total = w * h;
  if (!data || data.length < total * 4) return null;

  const gray = new Uint8Array(total);
  for (let i = 0, j = 0; j < total; i += 4, j++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    gray[j] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  const thr0 = otsuThreshold(gray, total);
  const thr = clamp(thr0 + thrBias, 0, 255);

  for (let j = 0, i = 0; j < total; j++, i += 4) {
    const keep = makeDark ? (gray[j] <= thr) : (gray[j] > thr);
    if (keep) {
      data[i] = drawColor[0];
      data[i + 1] = drawColor[1];
      data[i + 2] = drawColor[2];
      data[i + 3] = 255;
    } else {
      data[i + 3] = 0;
    }
  }
  ctx.putImageData(img, 0, 0);

  const bm = new fabric.Image(cv, {
    left: 0, top: 0,
    originX: "left", originY: "top",
    objectCaching: false,
    noScaleCache: true,
    selectable: true,
    evented: true
  });
  bm._vecSourceEl = element; // importante para recolorear y re-vectorizar
  bm._vecMeta = { w, h };
  bm._doboKind = "vector"; // etiqueta para el menú
  return bm;
}

// ======= Texto con pseudo-relieve plano (sólo capas visuales) y editable =======
function makeTextGroup(text, opts = {}) {
  // Grupo simple: base es el que define estilo/tamaño; sin relieve real.
  const base = new fabric.Textbox(text, {
    ...opts,
    originX: "center", originY: "center",
    selectable: true, evented: true,
    objectCaching: false,
    fill: opts.fill ?? "rgba(35,35,35,1)"
  });

  // Sombra y luz muy sutiles (opcional). Si no deseas nada, comenta shadow/highlight.
  const shadow = new fabric.Textbox(text, {
    ...opts,
    originX: "center", originY: "center",
    left: -1, top: -1,
    selectable: false, evented: false,
    objectCaching: false,
    fill: "",
    stroke: "rgba(0,0,0,0.25)", strokeWidth: 0.8
  });
  const highlight = new fabric.Textbox(text, {
    ...opts,
    originX: "center", originY: "center",
    left: +1, top: +1,
    selectable: false, evented: false,
    objectCaching: false,
    fill: "",
    stroke: "rgba(255,255,255,0.45)", strokeWidth: 0.5
  });

  const group = new fabric.Group([shadow, highlight, base], {
    originX: "center", originY: "center",
    subTargetCheck: false,
    objectCaching: false,
    selectable: true, evented: true,
    scaleX: 1, scaleY: 1
  });
  group._kind = "textGroup";
  group._textChildren = { base, shadow, highlight };

  const sync = () => {
    const sx = Math.max(1e-6, Math.abs(group.scaleX || 1));
    const sy = Math.max(1e-6, Math.abs(group.scaleY || 1));
    const ox = 1 / sx, oy = 1 / sy;
    shadow.set({ left: -ox, top: -oy });
    highlight.set({ left: +ox, top: +oy });
    group.setCoords();
    group.canvas?.requestRenderAll?.();
  };
  group.on("scaling", sync);
  group.on("modified", sync);
  sync();

  return group;
}

export default function CustomizationOverlay({
  stageRef,
  anchorRef,
  visible = true,
  zoom = 0.6,
  setZoom
}) {
  // ---- Refs y estado ----
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const overlayRef = useRef(null);
  const addInputVectorRef = useRef(null);
  const addInputRgbRef = useRef(null);
  const cameraInputRef = useRef(null);
  const menuRef = useRef(null);

  const [uploadMode, setUploadMode] = useState(null); // "vector" | "rgb"
  const [baseSize, setBaseSize] = useState({ w: 1, h: 1 });
  const [overlayBox, setOverlayBox] = useState({ left: 0, top: 0, w: 1, h: 1 });
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [selType, setSelType] = useState("none"); // 'none'|'text'|'image'

  // Historial
  const historyRef = useRef(null);
  const [histCaps, setHistCaps] = useState({ canUndo: false, canRedo: false });

  // Tipografía
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].css);
  const [fontSize, setFontSize] = useState(60);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState("center");
  const [textEditing, setTextEditing] = useState(false);

  // UI
  const [showAlignMenu, setShowAlignMenu] = useState(false);

  // Color (texto y vector)
  const [shapeColor, setShapeColor] = useState("#333333");

  // Vector
  const [vecBias, setVecBias] = useState(0); // -60..+60

  const suppressSelectionRef = useRef(false);
  const designBoundsRef = useRef(null);

  // ====== helpers de historial
  const getSnapshot = () => {
    const c = fabricCanvasRef.current;
    if (!c) return null;
    return c.toJSON(["_kind", "_textChildren", "_vecSourceEl", "_vecMeta", "_doboKind"]);
  };

  const applySnapshot = (snap) => {
    const c = fabricCanvasRef.current;
    if (!c || !snap) return;
    c._skipHistory = true;
    c.loadFromJSON(snap, () => {
      c._skipHistory = false;
      c.requestRenderAll();
    });
  };

  const refreshCaps = () => setHistCaps({
    canUndo: !!historyRef.current?.canUndo(),
    canRedo: !!historyRef.current?.canRedo()
  });

  const recordChange = (() => {
    let t = null;
    return () => {
      if (fabricCanvasRef.current?._skipHistory) return;
      clearTimeout(t);
      t = setTimeout(() => {
        const s = getSnapshot();
        if (s && historyRef.current) historyRef.current.push(s);
        refreshCaps();
      }, 140);
    };
  })();

  // ====== layout a partir de anchor y stage
  useLayoutEffect(() => {
    const el = anchorRef?.current;
    if (!el) return;
    const prev = el.style.position;
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    return () => { try { el.style.position = prev; } catch {} };
  }, [anchorRef]);

  useLayoutEffect(() => {
    const stage = stageRef?.current;
    const anchor = anchorRef?.current;
    if (!stage || !anchor) return;

    const measure = () => {
      const w = Math.max(1, anchor.clientWidth);
      const h = Math.max(1, anchor.clientHeight);
      let left = 0, top = 0;
      let el = anchor;
      while (el && el !== stage) {
        left += el.offsetLeft || 0;
        top += el.offsetTop || 0;
        el = el.offsetParent;
      }
      setBaseSize({ w, h });
      setOverlayBox({ left, top, w, h });

      const c = fabricCanvasRef.current;
      if (c) { c.setWidth(w); c.setHeight(h); c.calcOffset?.(); c.requestRenderAll?.(); }
    };

    measure();
    const roA = new ResizeObserver(measure);
    const roS = new ResizeObserver(measure);
    try { roA.observe(anchor); } catch {}
    try { roS.observe(stage); } catch {}
    window.addEventListener("resize", measure, { passive: true });

    return () => {
      try { roA.disconnect(); } catch {}
      try { roS.disconnect(); } catch {}
      window.removeEventListener("resize", measure);
    };
  }, [stageRef, anchorRef]);

  useEffect(() => {
    const v = typeof zoom === "number" ? zoom : 0.6;
    stageRef?.current?.style.setProperty("--zoom", String(v));
  }, [zoom, stageRef]);

// ====== init Fabric
useEffect(() => {
  if (!visible || !canvasRef.current || fabricCanvasRef.current) return;

  const c = new fabric.Canvas(canvasRef.current, {
    width: 1,
    height: 1,
    preserveObjectStacking: true,
    selection: true,
    perPixelTargetFind: true,
    targetFindTolerance: 8
  });
  fabricCanvasRef.current = c;

  // ✅ Permite gestos táctiles básicos en móvil sin anular scroll ni swipe fuera del área de edición
  if (c.upperCanvasEl) {
    c.upperCanvasEl.addEventListener("touchmove", (e) => {
      // Solo bloquea movimiento interno si se está editando dentro del canvas
      if (!editing) return;
      if (e.touches.length > 1) return; // deja pasar gestos multitouch (pinch-zoom, etc.)
      e.stopPropagation(); // evita que el canvas bloquee scroll horizontal o vertical
    }, { passive: false });
  }

  // === Activación de edición de texto (móvil + escritorio) con movimiento restaurado ===
  (() => {
    const c = fabricCanvasRef.current;
    if (!c) return;

    // 0) Foco y tolerancias táctiles
    if (c.upperCanvasEl) {
      c.upperCanvasEl.setAttribute("tabindex", "0");
      c.upperCanvasEl.style.touchAction = "none"; // evita el zoom del navegador sobre el canvas
      c.upperCanvasEl.addEventListener("touchstart", () => c.upperCanvasEl.focus(), { passive: false });
    }
    c.perPixelTargetFind = false;
    c.targetFindTolerance = 12;
    if (fabric?.Object?.prototype) fabric.Object.prototype.padding = 8;

    // 1) Utilidades
    const isTextTarget = (t) =>
      !!t && (t.type === "textbox" || t.type === "i-text" || t._kind === "textGroup");

    const enterEdit = (t) => {
      if (!isTextTarget(t)) return;
      requestAnimationFrame(() => {
        if (t.type === "textbox" || t.type === "i-text") {
          t.selectable = true;
          t.editable = true;
          t.evented = true;
          c.setActiveObject(t);
          t.enterEditing?.();
          t.hiddenTextarea?.focus?.();
        } else if (t._kind === "textGroup" && typeof startInlineTextEdit === "function") {
          startInlineTextEdit(t);
          c.setActiveObject(t);
        }
        c.requestRenderAll();
      });
    };

  // 2) Tap vs Drag + candado anti-doble-disparo
  let downInfo = null;
  let moved = false;
  let editLockUntil = 0; // ms timestamp: previene doble disparo

  const TAP_MAX_MS = 220;
  const TAP_MAX_MOVE = 6; // px
  const dist = (a, b) => Math.hypot((a.x - b.x), (a.y - b.y));

  c.on("mouse:down", (opt) => {
    const now = performance.now();
    moved = false;
    downInfo = {
      x: opt.pointer?.x ?? 0,
      y: opt.pointer?.y ?? 0,
      t: now,
      target: opt.target || null
    };
  });

  c.on("mouse:move", (opt) => {
    if (!downInfo) return;
    const p = opt.pointer || { x: 0, y: 0 };
    if (dist({ x: p.x, y: p.y }, { x: downInfo.x, y: downInfo.y }) > TAP_MAX_MOVE) {
      moved = true;
    }
  });

  c.on("mouse:up", (opt) => {
    const now = performance.now();
    if (!downInfo) return;

    const t = downInfo.target;
    const duration = now - downInfo.t;

    // Candado activo → nada
    if (now < editLockUntil) { downInfo = null; return; }

    // TAP corto sobre texto => editar
    if (!moved && duration <= TAP_MAX_MS && isTextTarget(t)) {
      opt.e?.preventDefault?.();
      opt.e?.stopPropagation?.();
      enterEdit(t);
      editLockUntil = now + 300; // evita doble disparo inmediato
    }

    downInfo = null;
  });

  // Doble clic / doble tap → editar (respetando candado)
  c.on("mouse:dblclick", (opt) => {
    const now = performance.now();
    const t = opt.target;
    if (!isTextTarget(t)) return;
    if (now < editLockUntil) return;

    opt.e?.preventDefault?.();
    opt.e?.stopPropagation?.();
    enterEdit(t);
    editLockUntil = now + 300;
  });

  // 3) Tras salir de edición, vuelve a permitir mover/seleccionar
  c.on("text:editing:exited", (opt) => {
    const t = opt?.target;
    if (!t) return;

    // Asegura movimiento/selección otra vez
    t.editable = true;
    t.selectable = true;
    t.evented = true;
    t.hasControls = true;
    t.lockMovementX = false;
    t.lockMovementY = false;

    c.setActiveObject(t);
    c.requestRenderAll();
  });
})();


    // Delimitar bounds (margen 10 px)
    const setDesignBounds = ({ x, y, w, h }) => { designBoundsRef.current = { x, y, w, h }; };
    setDesignBounds({ x: 10, y: 10, w: c.getWidth() - 20, h: c.getHeight() - 20 });

    // Enforcers de límites
    const clampObjectToBounds = (obj) => {
      const b = designBoundsRef.current; if (!b || !obj) return;
      obj.setCoords();
      const r = obj.getBoundingRect(true);
      let dx = 0, dy = 0;
      if (r.left < b.x) dx = b.x - r.left;
      if (r.top < b.y) dy = b.y - r.top;
      if (r.left + r.width > b.x + b.w) dx = (b.x + b.w) - (r.left + r.width);
      if (r.top + r.height > b.y + b.h) dy = (b.y + b.h) - (r.top + r.height);
      if (dx || dy) {
        obj.left = (obj.left ?? 0) + dx;
        obj.top = (obj.top ?? 0) + dy;
        obj.setCoords();
      }
    };
    const __bounds_onMove = e => clampObjectToBounds(e.target);
    const __bounds_onScale = e => clampObjectToBounds(e.target);
    const __bounds_onRotate = e => clampObjectToBounds(e.target);
    const __bounds_onAdded = e => clampObjectToBounds(e.target);
    c.on("object:moving", __bounds_onMove);
    c.on("object:scaling", __bounds_onScale);
    c.on("object:rotating", __bounds_onRotate);
    c.on("object:added", __bounds_onAdded);

    const __bounds_ro = new ResizeObserver(() => {
      const cw = c.getWidth(), ch = c.getHeight();
      setDesignBounds({ x: 10, y: 10, w: cw - 20, h: ch - 20 });
      const a = c.getActiveObject(); if (a) clampObjectToBounds(a);
    });
    __bounds_ro.observe(c.upperCanvasEl);

    // Historial
    historyRef.current = new HistoryManager({ limit: 200, onChange: refreshCaps });
    c.once("after:render", () => {
      const s = getSnapshot(); if (s) historyRef.current.push(s);
      refreshCaps();
    });
    const __hist_onAdded = () => recordChange();
    const __hist_onModified = () => recordChange();
    const __hist_onRemoved = () => recordChange();
    const __hist_onPath = () => recordChange();
    c.on("object:added", __hist_onAdded);
    c.on("object:modified", __hist_onModified);
    c.on("object:removed", __hist_onRemoved);
    c.on("path:created", __hist_onPath);

    // Selección: clasificar
    const classify = (a) => {
      if (!a) return "none";
      if (a._kind === "textGroup") return "text";
      if (a._doboKind === "vector") return "image";
      if (a.type === "image") return "image";
      if (a.type === "i-text" || a.type === "textbox" || a.type === "text") return "text";
      return "none";
    };

    const isTextObj = (o) => o && (o.type === "i-text" || o.type === "textbox" || o.type === "text");

    const reflectTypo = () => {
      const a = c.getActiveObject();
      if (!a) return;
      let first = null;
      if (a._kind === "textGroup") first = a._textChildren?.base || null;
      else if (a.type === "activeSelection") first = a._objects?.find(x => x._kind === "textGroup")?._textChildren?.base || null;
      else if (isTextObj(a)) first = a;
      if (first) {
        setFontFamily(first.fontFamily || FONT_OPTIONS[0].css);
        setFontSize(first.fontSize || 60);
        setIsBold((first.fontWeight + "" === "700") || first.fontWeight === "bold");
        setIsItalic((first.fontStyle + "" === "italic"));
        setIsUnderline(!!first.underline);
        setTextAlign(first.textAlign || "center");
      }
    };

    const onSel = () => {
      const cobj = c.getActiveObject();
      if (suppressSelectionRef.current) {
        try { if (cobj?.type === "activeSelection") cobj.discard(); } catch {}
        try { c.discardActiveObject(); } catch {}
        try { c.setActiveObject(null); } catch {}
        try { c._activeObject = null; } catch {}
        setSelType("none");
        c.requestRenderAll();
        return;
      }
      setSelType(classify(cobj));
      reflectTypo();
    };
    c.on("selection:created", onSel);
    c.on("selection:updated", onSel);
    c.on("selection:cleared", () => setSelType("none"));

    // Doble-clic para texto editable
    c.on("mouse:dblclick", (e) => {
      const t = e.target;
      if (!t) return;
      if (t._kind === "textGroup") {
        startInlineTextEdit(t);
      } else if (isTextObj(t) && typeof t.enterEditing === "function") {
        t.enterEditing();
        c.requestRenderAll();
      }
    });

    setReady(true);
    
// === DOBO: exponer API global para correo y checkout ===
if (typeof window !== "undefined") {
 const api = {
    // existentes
    toPNG: (mult = 3) => c.toDataURL({ format: 'png', multiplier: mult, backgroundColor: 'transparent' }),

    toSVG: () => c.toSVG({ suppressPreamble: true }),
    getCanvas: () => c,
    exportDesignSnapshot: () => {
      try { return c.toJSON(); } catch { return null; }
    },
    importDesignSnapshot: (snap) => new Promise(res => {
      try { c.loadFromJSON(snap, () => { c.requestRenderAll(); res(true); }); } catch { res(false); }
    }),
    reset: () => { try { c.clear(); c.requestRenderAll(); } catch {} }
  };
  window.doboDesignAPI = api;
  try {
    window.dispatchEvent(new CustomEvent("dobo:ready", { detail: api }));
    console.log("[DOBO] API global inicializada ✅");
  } catch {}
}

    return () => {
      c.off("mouse:dblclick");
      c.off("selection:created", onSel);
      c.off("selection:updated", onSel);
      c.off("selection:cleared");
      c.off("object:added", __hist_onAdded);
      c.off("object:modified", __hist_onModified);
      c.off("object:removed", __hist_onRemoved);
      c.off("path:created", __hist_onPath);

      c.off("object:moving", __bounds_onMove);
      c.off("object:scaling", __bounds_onScale);
      c.off("object:rotating", __bounds_onRotate);
      c.off("object:added", __bounds_onAdded);
      try { __bounds_ro.disconnect(); } catch {}
      try { c.dispose(); } catch {}
      fabricCanvasRef.current = null;
    };
  }, [visible]);

  // Ajuste de tamaño si cambian baseSize
  useEffect(() => {
    const c = fabricCanvasRef.current;
    if (!c) return;
    c.setWidth(baseSize.w);
    c.setHeight(baseSize.h);
    c.calcOffset?.();
    c.requestRenderAll?.();
  }, [baseSize.w, baseSize.h]);

  // Interactividad segun "editing"
  useEffect(() => {
    const c = fabricCanvasRef.current;
    if (!c) return;

    const enableNode = (o, on) => {
      if (!o) return;
      const isGroup = o._kind === "textGroup";
      o.selectable = on;
      o.evented = on;
      o.lockMovementX = !on;
      o.lockMovementY = !on;
      o.hasControls = on;
      o.hasBorders = on;
      if (!isGroup && (o.type === "i-text" || typeof o.enterEditing === "function")) o.editable = on;
      o.hoverCursor = on ? "move" : "default";
      if (isGroup) return;
      const children = o._objects || (typeof o.getObjects === "function" ? o.getObjects() : null);
      if (Array.isArray(children)) children.forEach(ch => enableNode(ch, on));
    };

    const setAll = (on) => {
      c.skipTargetFind = !on;
      c.selection = on;
      (c.getObjects?.() || []).forEach(o => enableNode(o, on));
      const upper = c.upperCanvasEl;
      if (upper) {
        upper.style.pointerEvents = on ? "auto" : "none";
        upper.style.touchAction = on ? "manipulation" : "auto";
        upper.tabIndex = on ? 0 : -1;
      }
      c.defaultCursor = on ? "move" : "default";
      try { c.discardActiveObject(); } catch {}
      c.calcOffset?.();
      c.requestRenderAll?.();
      setTimeout(() => { c.calcOffset?.(); c.requestRenderAll?.(); }, 0);
    };

    setAll(!!editing);
  }, [editing]);

  // ======= Edición inline de texto (grupo) =======
  const startInlineTextEdit = (group) => {
    const c = fabricCanvasRef.current; if (!c || !group || group._kind !== "textGroup") return;
    const base = group._textChildren?.base; if (!base) return;

    const pose = {
      left: group.left, top: group.top, originX: "center", originY: "center",
      scaleX: group.scaleX || 1, scaleY: group.scaleY || 1, angle: group.angle || 0
    };

    try { c.remove(group); } catch {}

    const tb = new fabric.Textbox(base.text || "Texto", {
      left: pose.left, top: pose.top, originX: "center", originY: "center",
      width: Math.min(baseSize.w * 0.9, base.width || 240),
      fontFamily: base.fontFamily, fontSize: base.fontSize, fontWeight: base.fontWeight,
      fontStyle: base.fontStyle, underline: base.underline, textAlign: base.textAlign,
      editable: true, selectable: true, evented: true, objectCaching: false,
      fill: base.fill || "rgba(35,35,35,1)"
    });

    c.add(tb);
    c.setActiveObject(tb);
    c.requestRenderAll();
    setTextEditing(true);

    setTimeout(() => {
      try { tb.enterEditing?.(); } catch {}
      try { tb.hiddenTextarea?.focus(); } catch {}
      setTimeout(() => { try { tb.hiddenTextarea?.focus(); } catch {} }, 60);
    }, 0);

    const finish = () => {
      const newText = tb.text || "";
      const finalPose = {
        left: tb.left, top: tb.top, originX: tb.originX, originY: tb.originY,
        scaleX: tb.scaleX, scaleY: tb.scaleY, angle: tb.angle
      };
      try { c.remove(tb); } catch {}

      const group2 = makeTextGroup(newText, {
        width: tb.width,
        fontFamily: tb.fontFamily, fontSize: tb.fontSize, fontWeight: tb.fontWeight,
        fontStyle: tb.fontStyle, underline: tb.underline, textAlign: tb.textAlign,
        fill: tb.fill
      });
      group2.set(finalPose);
      c.add(group2);
      c.setActiveObject(group2);
      c.requestRenderAll();
      setSelType("text");
      setTextEditing(false);
    };

    const onExit = () => { tb.off("editing:exited", onExit); finish(); };
    tb.on("editing:exited", onExit);
    const safety = setTimeout(() => {
      try { tb.off("editing:exited", onExit); } catch {}
      finish();
    }, 15000);
    tb.on("removed", () => { clearTimeout(safety); });
  };

  // ======= Acciones =======
  const addText = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    const group = makeTextGroup("Nuevo texto", {
      width: Math.min(baseSize.w * 0.9, 240),
      fontSize, fontFamily, fontWeight: isBold ? "700" : "normal",
      fontStyle: isItalic ? "italic" : "normal",
      underline: isUnderline, textAlign,
      fill: `rgba(${hexToRgb(shapeColor).join(",")},1)`
    });
    group.set({ left: baseSize.w / 2, top: baseSize.h / 2, originX: "center", originY: "center" });
    const cobj = c.add(group);
    c.setActiveObject(group);
    setSelType("text");
    c.requestRenderAll();
    setEditing(true);
    return cobj;
  };

// Carga imagen (RGB / Cámara / Vector) con espera inteligente a que el canvas esté listo.
// Evita el error "fabric: Error loading blob:" usando FileReader (DataURL) y sincroniza el render.
// Carga de imágenes robusta (funciona al primer intento, incluso en montajes lentos)
const addImageFromFile = (file, mode) => {
  if (!file) return;

  const waitForCanvasReady = (attempt = 0) => {
    const c = fabricCanvasRef.current;
    if (!c || !c.getContext || !c.getContext()) {
      if (attempt < 10) {
        console.warn(`[DOBO] Canvas aún inicializando (${attempt + 1}/10)...`);
        setTimeout(() => waitForCanvasReady(attempt + 1), 80);
      } else {
        console.error("[DOBO] Canvas no disponible tras varios intentos.");
      }
      return;
    }

    // --- ya hay canvas listo ---
    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = reader.result;
      const imgEl = new Image();
      imgEl.crossOrigin = "anonymous";

      imgEl.onload = () => {
        const src = typeof downscale === "function" ? downscale(imgEl) : imgEl;

        // vector mode
        if (mode === "vector") {
          const rgb = hexToRgb?.(shapeColor) ?? { r: 0, g: 0, b: 0 };
          const vectorImg = vectorizeElementToBitmap?.(src, {
            maxDim: typeof VECTOR_SAMPLE_DIM !== "undefined" ? VECTOR_SAMPLE_DIM : 1024,
            makeDark: true,
            drawColor: rgb,
            thrBias: typeof vecBias !== "undefined" ? vecBias : 0
          });
          if (!vectorImg) return;

          const maxW = c.getWidth() * 0.8;
          const maxH = c.getHeight() * 0.8;
          const vw = vectorImg._vecMeta?.w || vectorImg.width || 1;
          const vh = vectorImg._vecMeta?.h || vectorImg.height || 1;
          const s = Math.min(maxW / vw, maxH / vh, 1);

          vectorImg.set({
            originX: "center",
            originY: "center",
            left: c.getWidth() / 2,
            top: c.getHeight() / 2,
            scaleX: s,
            scaleY: s,
            selectable: true,
            evented: true,
            objectCaching: false
          });

          c.add(vectorImg);
          c.setActiveObject(vectorImg);
          setSelType?.("image");
          setEditing?.(true);

          requestAnimationFrame(() => {
            c.calcOffset?.();
            c.renderAll?.();
          });
          return;
        }

        // RGB / Cámara
        const baseEl =
          src && (src instanceof HTMLCanvasElement || src instanceof HTMLImageElement)
            ? src
            : imgEl;

        const fabricImg = new fabric.Image(baseEl, {
          originX: "center",
          originY: "center",
          left: c.getWidth() / 2,
          top: c.getHeight() / 2,
          selectable: true,
          evented: true,
          objectCaching: false
        });
        fabricImg._doboKind = mode === "camera" ? "camera" : "rgb";

        const maxW = c.getWidth() * 0.85;
        const maxH = c.getHeight() * 0.85;
        const naturalW = baseEl.naturalWidth || baseEl.width || fabricImg.width || 1;
        const naturalH = baseEl.naturalHeight || baseEl.height || fabricImg.height || 1;
        const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
        fabricImg.set({ scaleX: scale, scaleY: scale });

        c.add(fabricImg);
        c.setActiveObject(fabricImg);
        setSelType?.("image");
        setEditing?.(true);

        requestAnimationFrame(() => {
          c.calcOffset?.();
          c.renderAll?.();
        });
      };

      imgEl.onerror = () => console.error("[DOBO] Error cargando imagen");
      imgEl.src = dataUrl;
    };

    reader.readAsDataURL(file);
  };

  // inicia flujo
  waitForCanvasReady();
};






  const onDelete = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;

    const removeOne = (o) => { if (!o) return; try { c.remove(o); } catch {} };

    if (a.type === "activeSelection" && a._objects?.length) {
      const arr = a._objects.slice();
      a.discard();
      arr.forEach(removeOne);
    } else {
      removeOne(a);
    }
    c.discardActiveObject();
    c.requestRenderAll();
    setSelType("none");
  };

  const applyToSelection = (mutator) => {
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;

    const applyToGroup = (g) => {
      if (!g || g._kind !== "textGroup") return;
      const { base, shadow, highlight } = g._textChildren || {};
      [base, shadow, highlight].forEach(o => o && mutator(o));
      const sx = Math.max(1e-6, Math.abs(g.scaleX || 1));
      const sy = Math.max(1e-6, Math.abs(g.scaleY || 1));
      const ox = 1 / sx, oy = 1 / sy;
      shadow?.set({ left: -ox, top: -oy });
      highlight?.set({ left: +ox, top: +oy });
      g.setCoords();
    };

    if (a.type === "activeSelection" && Array.isArray(a._objects)) {
      a._objects.forEach(applyToGroup);
    } else if (a._kind === "textGroup") {
      applyToGroup(a);
    } else if (a.type === "textbox" || a.type === "i-text" || a.type === "text") {
      mutator(a);
    }
    c.requestRenderAll();
  };

  // Cambiar color a vector (re-vectoriza con el color actual)
  const applyColorToActive = (hex) => {
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;
    const rgb = hexToRgb(hex);

    const rebuildVector = (obj) => {
      let element = null;
      let pose = null;

      if (obj?._doboKind === "vector") {
        const baseEl = obj._vecSourceEl || (typeof obj.getElement === "function" ? obj.getElement() : obj._element);
        if (!baseEl) return;
        element = baseEl;
        pose = {
          left: obj.left, top: obj.top, originX: obj.originX, originY: obj.originY,
          scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle || 0
        };
        try { obj.canvas.remove(obj); } catch {}
      } else {
        // texto normal (si llegó acá)
        return;
      }

      const baseImg = vectorizeElementToBitmap(element, {
        maxDim: VECTOR_SAMPLE_DIM,
        makeDark: true,
        drawColor: rgb,
        thrBias: vecBias
      });
      if (!baseImg) return;
      baseImg._doboKind = "vector";
      baseImg.set({
        selectable: true, evented: true, objectCaching: false
      });
      baseImg.set(pose);
      c.add(baseImg);
      c.setActiveObject(baseImg);
    };

    if (a.type === "activeSelection" && a._objects?.length) {
      const arr = a._objects.slice(); a.discard(); arr.forEach(rebuildVector);
    } else if (a._doboKind === "vector") {
      rebuildVector(a);
    } else if (a._kind === "textGroup" || a.type === "textbox" || a.type === "i-text" || a.type === "text") {
      // Cambiar color del texto
      applyToSelection(o => o.set({ fill: `rgba(${rgb.join(",")},1)` }));
    }

    c.requestRenderAll();
  };

  // Re-vectorizar cuando cambia “Detalles” (vecBias) SOLO si hay vector seleccionado
  useEffect(() => {
    if (!editing || selType !== "image") return;
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;

    const maybeRebuild = (obj) => {
      if (obj?._doboKind !== "vector") return;
      const element = obj._vecSourceEl || (typeof obj.getElement === "function" ? obj.getElement() : obj._element);
      if (!element) return;
      const pose = {
        left: obj.left, top: obj.top, originX: obj.originX, originY: obj.originY,
        scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle || 0
      };
      try { obj.canvas.remove(obj); } catch {}

      const rgb = hexToRgb(shapeColor);
      const baseImg = vectorizeElementToBitmap(element, {
        maxDim: VECTOR_SAMPLE_DIM,
        makeDark: true,
        drawColor: rgb,
        thrBias: vecBias
      });
      if (!baseImg) return;
      baseImg._doboKind = "vector";
      baseImg.set({ selectable: true, evented: true, objectCaching: false });
      baseImg.set(pose);
      c.add(baseImg);
      c.setActiveObject(baseImg);
    };

    if (a.type === "activeSelection" && a._objects?.length) {
      const arr = a._objects.slice(); a.discard(); arr.forEach(maybeRebuild);
    } else {
      maybeRebuild(a);
    }
    c.requestRenderAll();
  }, [vecBias]); // eslint-disable-line react-hooks/exhaustive-deps

  // ====== Zoom de rueda básico (opcional)
  useEffect(() => {
    const host = stageRef?.current || fabricCanvasRef.current?.upperCanvasEl;
    if (!host) return;
    const onWheel = (e) => {
      if (textEditing) return;
      e.preventDefault();
      const current = parseFloat(stageRef?.current?.style.getPropertyValue("--zoom") || "1") || 1;
      const next = clamp(current + (e.deltaY > 0 ? -0.08 : 0.08), 0.6, 2.5);
      stageRef?.current?.style.setProperty("--zoom", String(next));
      if (typeof setZoom === "function") setZoom(next);
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, [stageRef, setZoom, textEditing]);

  if (!visible) return null;

  // ====== Overlay Canvas (posicionado dentro del anchor/stage)
  const OverlayCanvas = (
    <div
      ref={overlayRef}
      style={{
        position: "absolute",
        left: overlayBox.left,
        top: overlayBox.top,
        width: overlayBox.w,
        height: overlayBox.h,
        zIndex: Z_CANVAS,
        overflow: "hidden",
        pointerEvents: editing ? "auto" : "none",
        touchAction: editing ? "none" : "auto",
        overscrollBehavior: "contain"
      }}
      onPointerDown={(e) => { if (editing) e.stopPropagation(); }}
    >
      <canvas
        data-dobo-design="1"
        ref={canvasRef}
        width={overlayBox.w}
        height={overlayBox.h}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          background: "transparent",
          touchAction: editing ? "none" : "auto"
        }}
      />
    </div>
  );

  // ====== Menú ======
  const Menu = () => {
    const c = fabricCanvasRef.current;
    const a = c?.getActiveObject();
    const isVectorSelected =
      selType === "image" && a && a._doboKind === "vector";
    const isRgbSelected =
      selType === "image" && a && a._doboKind === "rgb";

    return (
      <div
        ref={menuRef}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: "rgba(253, 253, 253, 0.34)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: "10px 12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          width: "auto",
          maxWidth: "94vw",
          fontSize: 12,
          userSelect: "none"
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        {/* Línea 1: historial + zoom + modos */}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="btn-group btn-group-sm" role="group" aria-label="Historial">
            <button
              type="button" className="btn btn-outline-secondary"
              onPointerDown={(e)=>e.stopPropagation()} onMouseDown={(e)=>e.preventDefault()}
              onClick={() => { const s = historyRef.current?.undo(); if (s) applySnapshot(s); refreshCaps(); }}
              disabled={!histCaps.canUndo} title="Atrás (Ctrl+Z)" aria-label="Atrás"
            >
              <i className="fa fa-undo" aria-hidden="true"></i>
            </button>
            <button
              type="button" className="btn btn-outline-secondary"
              onPointerDown={(e)=>e.stopPropagation()} onMouseDown={(e)=>e.preventDefault()}
              onClick={() => { const s = historyRef.current?.redo(); if (s) applySnapshot(s); refreshCaps(); }}
              disabled={!histCaps.canRedo} title="Adelante (Ctrl+Shift+Z)" aria-label="Adelante"
            >
              <i className="fa fa-repeat" aria-hidden="true"></i>
            </button>
          </div>

          {typeof setZoom === "function" && (
            <div className="input-group input-group-sm" style={{ width: 180 }}>
              <span className="input-group-text">Zoom</span>
              <button
                type="button" className="btn btn-outline-secondary"
                onClick={() => setZoom(z => Math.max(0.8, +(z - 0.1).toFixed(2)))}
              >−</button>
              <input type="text" readOnly className="form-control form-control-sm text-center"
                value={`${Math.round((zoom || 1) * 100)}%`} />
              <button
                type="button" className="btn btn-outline-secondary"
                onClick={() => setZoom(z => Math.min(2.5, +(z + 0.1).toFixed(2)))}
              >+</button>
            </div>
          )}

          <button
            type="button"
            className={`btn ${!editing ? "btn-dark" : "btn-outline-secondary"} text-nowrap`}
            onMouseDown={(e)=>e.preventDefault()}
            onPointerDown={(e)=>e.stopPropagation()}
            onClick={() => setEditing(false)}
            style={{ minWidth: "16ch" }}
          >
            Seleccionar Maceta
          </button>

          <button
            type="button"
            className={`btn ${editing ? "btn-dark" : "btn-outline-secondary"} text-nowrap`}
            onMouseDown={(e)=>e.preventDefault()}
            onPointerDown={(e)=>e.stopPropagation()}
            onClick={() => setEditing(true)}
            style={{ minWidth: "12ch" }}
          >
            Diseñar
          </button>
        </div>

        {/* Línea 2: acciones básicas */}
        {editing && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              type="button" className="btn btn-sm btn-outline-secondary"
              onPointerDown={(e)=>e.stopPropagation()}
              onClick={addText} disabled={!ready}
              title="Agregar texto"
            >
              <i className="fa fa-font" aria-hidden="true"></i> Texto
            </button>

            <div className="btn-group btn-group-sm" role="group" aria-label="Cargas">
              {/* Subir Vector */}
              <button
                type="button" className="btn btn-outline-secondary"
                onPointerDown={(e)=>e.stopPropagation()}
                onClick={() => { setUploadMode("vector"); requestAnimationFrame(() => {
  addInputVectorRef.current?.click();
}); }}
                disabled={!ready}
                title="Subir vector (usa Detalles y Color)"
              >
                <i className="fa fa-magic" aria-hidden="true"></i> Vector
              </button>
              {/* Subir RGB */}
              <button
                type="button" className="btn btn-outline-secondary"
                onPointerDown={(e)=>e.stopPropagation()}
                onClick={() => { setUploadMode("rgb"); requestAnimationFrame(() => {
  addInputRgbRef.current?.click();
}); }}
                disabled={!ready}
                title="Subir imagen RGB (color original)"
              >
                <i className="fa fa-image" aria-hidden="true"></i> Imagen
              </button>
              {/* Cámara */}
              <button
                type="button" className="btn btn-outline-secondary"
                onPointerDown={(e)=>e.stopPropagation()}
                onClick={() => { setUploadMode("rgb"); requestAnimationFrame(() => {
  cameraInputRef.current?.click();
}); }}
                disabled={!ready}
                title="Tomar foto con cámara"
              >
                <i className="fa fa-camera" aria-hidden="true"></i> Cámara
              </button>
            </div>

            <button
              type="button" className="btn btn-sm btn-outline-danger"
              onPointerDown={(e)=>e.stopPropagation()}
              onClick={onDelete}
              disabled={!ready || selType === "none"}
              title="Eliminar seleccionado"
            >
              <i className="fa fa-trash" aria-hidden="true"></i> Borrar
            </button>
          </div>
        )}

        {/* Línea 3: propiedades */}
        {editing && (
          <>
            {/* Texto */}
            {selType === "text" && (
              <>
                <div className="input-group input-group-sm" style={{ maxWidth: 220, marginBottom: 6 }}>
                  <span className="input-group-text">Color</span>
                  <input
                    type="color" className="form-control form-control-color"
                    value={shapeColor}
                    onChange={(e)=>{ setShapeColor(e.target.value); applyToSelection(o => o.set({ fill: `rgba(${hexToRgb(e.target.value).join(",")},1)` })); }}
                    onPointerDown={(e)=>e.stopPropagation()}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                  <div className="input-group input-group-sm" style={{ maxWidth: 240 }}>
                    <span className="input-group-text">Fuente</span>
                    <select
                      className="form-select form-select-sm"
                      value={fontFamily}
                      onChange={(e) => { const v = e.target.value; setFontFamily(v); applyToSelection(o => o.set({ fontFamily: v })); }}
                      onPointerDown={(e)=>e.stopPropagation()}
                    >
                      {FONT_OPTIONS.map(f => (
                        <option key={f.name} value={f.css} style={{ fontFamily: f.css }}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="btn-group btn-group-sm" role="group" aria-label="Estilos">
                    <button
                      type="button" className={`btn ${isBold ? "btn-dark" : "btn-outline-secondary"}`}
                      onPointerDown={(e)=>e.stopPropagation()}
                      onClick={() => { const nv = !isBold; setIsBold(nv); applyToSelection(o => o.set({ fontWeight: nv ? "700" : "normal" })); }}
                      title="Negrita"
                    >B</button>
                    <button
                      type="button" className={`btn ${isItalic ? "btn-dark" : "btn-outline-secondary"}`}
                      onPointerDown={(e)=>e.stopPropagation()}
                      onClick={() => { const nv = !isItalic; setIsItalic(nv); applyToSelection(o => o.set({ fontStyle: nv ? "italic" : "normal" })); }}
                      title="Cursiva"
                    >I</button>
                    <button
                      type="button" className={`btn ${isUnderline ? "btn-dark" : "btn-outline-secondary"}`}
                      onPointerDown={(e)=>e.stopPropagation()}
                      onClick={() => { const nv = !isUnderline; setIsUnderline(nv); applyToSelection(o => o.set({ underline: nv })); }}
                      title="Subrayado"
                    >U</button>
                  </div>

                  <div className="input-group input-group-sm" style={{ width: 160 }}>
                    <span className="input-group-text">Tamaño</span>
                    <input
                      type="number" className="form-control form-control-sm"
                      min={8} max={200} step={1}
                      value={fontSize}
                      onPointerDown={(e)=>e.stopPropagation()}
                      onChange={(e) => {
                        const v = clamp(parseInt(e.target.value || "0", 10), 8, 200);
                        setFontSize(v); applyToSelection(o => o.set({ fontSize: v }));
                      }}
                    />
                  </div>

                  <div className="btn-group dropup">
                    <button
                      type="button" className="btn btn-outline-secondary btn-sm"
                      onPointerDown={(e)=>e.stopPropagation()}
                      onClick={() => setShowAlignMenu(v => !v)}
                      title="Alineación"
                    >
                      {textAlign === "left" ? "⟸" : textAlign === "center" ? "⟺" : textAlign === "right" ? "⟹" : "≣"}
                    </button>
                    {showAlignMenu && (
                      <ul className="dropdown-menu show" style={{ position: "absolute" }}>
                        {["left","center","right","justify"].map(a => (
                          <li key={a}>
                            <button
                              type="button"
                              className={`dropdown-item ${textAlign === a ? "active" : ""}`}
                              onPointerDown={(e)=>e.stopPropagation()}
                              onClick={() => { setTextAlign(a); setShowAlignMenu(false); applyToSelection(o => o.set({ textAlign: a })); }}
                            >
                              {a}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Imagen */}
            {selType === "image" && (
              <>
                {/* Color: solo afecta a vectores */}
                <div className="input-group input-group-sm" style={{ maxWidth: 220, marginBottom: 6 }}>
                  <span className="input-group-text">Color</span>
                  <input
                    type="color" className="form-control form-control-color"
                    value={shapeColor}
                    onChange={(e)=>{ setShapeColor(e.target.value); if (isVectorSelected) applyColorToActive(e.target.value); }}
                    onPointerDown={(e)=>e.stopPropagation()}
                    disabled={!isVectorSelected}
                    title={isVectorSelected ? "Color del vector" : "Solo para vectores"}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  {/* Detalles: solo para vectores */}
                  <div className="input-group input-group-sm" style={{ width: 230 }}>
                    <span className="input-group-text">Detalles</span>
                    <button
                      type="button" className="btn btn-outline-secondary"
                      onPointerDown={(e)=>e.stopPropagation()}
                      onClick={() => setVecBias(v => clamp(v - 5, -60, 60))}
                      disabled={!isVectorSelected}
                    >−</button>
                    <input type="text" readOnly className="form-control form-control-sm text-center" value={vecBias} />
                    <button
                      type="button" className="btn btn-outline-secondary"
                      onPointerDown={(e)=>e.stopPropagation()}
                      onClick={() => setVecBias(v => clamp(v + 5, -60, 60))}
                      disabled={!isVectorSelected}
                    >+</button>
                  </div>

                  {/* Indicador RGB */}
                  {isRgbSelected && (
                    <span className="badge bg-secondary" title="Imagen RGB (no afecta Color ni Detalles)">RGB</span>
                  )}
                </div>
              </>
            )}
          </>
        )}

     {/* Inputs ocultos */}
<input
  ref={addInputVectorRef}
  type="file"
  accept="image/*"
  style={{ display: "none" }}
  onChange={(e) => {
    const f = e.target.files?.[0];
    if (f) {
      addImageFromFile(f, "vector");
    }
    // 🔧 limpiar inmediatamente para permitir reusar el input
    e.target.value = null;
  }}
  onPointerDown={(e) => e.stopPropagation()}
/>

<input
  ref={addInputRgbRef}
  type="file"
  accept="image/*"
  style={{ display: "none" }}
  onChange={(e) => {
    const f = e.target.files?.[0];
    if (f) {
      addImageFromFile(f, "rgb");
    }
    // 🔧 limpiar inmediatamente para asegurar que onChange se dispare siempre
    e.target.value = null;
  }}
  onPointerDown={(e) => e.stopPropagation()}
/>

<input
  ref={cameraInputRef}
  id="cameraInput"
  type="file"
  accept="image/*"
  capture="environment"
  style={{ display: "none" }}
  onChange={(e) => {
    const f = e.target.files?.[0];
    if (f) {
      addImageFromFile(f, "camera"); // 🔧 diferenciamos modo cámara
    }
    e.target.value = null;
  }}
  onPointerDown={(e) => e.stopPropagation()}
/>
</div>
  ); 
};

  return (
    <>
      {stageRef?.current ? createPortal(OverlayCanvas, stageRef.current) : null}

      {anchorRef?.current ? createPortal(
        <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center", pointerEvents: "none", marginTop: 8 }}>
          <div style={{ pointerEvents: "auto", display: "inline-flex" }}><Menu /></div>
        </div>,
        document.getElementById("dobo-menu-dock") || document.body
      ) : null}
    </>
  );
}
