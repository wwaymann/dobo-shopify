// components/CustomizationOverlay.js
// DOBO – CustomizationOverlay (vectorizada + RGB) – Nov 2025 (versión limpia)
// Español neutro. Mantiene lo que ya funciona y agrega dos botones separados:
// 1) Subir Vectorizada (permite elegir color)
// 2) Subir RGB (imagen fotográfica; no aplica color)

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { createPortal } from "react-dom";

// ============================================================
// Utilidades
// ============================================================
const MAX_TEXTURE_DIM = 1600;
const VECTOR_SAMPLE_DIM = 500;
const Z_CANVAS = 4000;
const Z_MENU = 10000;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function hexToRgb(hex) {
  const m = String(hex || "").replace("#", "").match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return [51, 51, 51];
  let s = m[1];
  if (s.length === 3) s = s.split("").map(ch => ch + ch).join("");
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const FONT_OPTIONS = [
  { name: "Arial", css: "Arial, Helvetica, sans-serif" },
  { name: "Georgia", css: "Georgia, serif" },
  { name: "Times New Roman", css: "\"Times New Roman\", Times, serif" },
  { name: "Courier New", css: "\"Courier New\", Courier, monospace" },
  { name: "Trebuchet MS", css: "\"Trebuchet MS\", Tahoma, sans-serif" },
  { name: "Montserrat", css: "Montserrat, Arial, sans-serif" },
  { name: "Poppins", css: "Poppins, Arial, sans-serif" },
];

// ============================================================
// Vectorización (el mismo sistema DOBO que hemos venido usando)
// ============================================================
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

// Convierte una imagen en bitmap vectorizado monocolor con transparencia
function vectorizeElementToBitmap(element, opts = {}) {
  const {
    maxDim   = VECTOR_SAMPLE_DIM,
    makeDark = true,
    drawColor = [51, 51, 51],
    thrBias  = 0
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
  try { img = ctx.getImageData(0, 0, w, h); } catch { return null; }
  const data = img?.data;
  const total = w * h;
  if (!data || data.length < total * 4) return null;

  const gray = new Uint8Array(total);
  for (let i = 0, j = 0; j < total; i += 4, j++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    gray[j] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  const thr0 = otsuThreshold(gray, total);
  const thr  = clamp(thr0 + thrBias, 0, 255);

  for (let j = 0, i = 0; j < total; j++, i += 4) {
    const keep = makeDark ? (gray[j] <= thr) : (gray[j] > thr);
    if (keep) {
      data[i]   = drawColor[0];
      data[i+1] = drawColor[1];
      data[i+2] = drawColor[2];
      data[i+3] = 255;
    } else {
      data[i+3] = 0;
    }
  }
  ctx.putImageData(img, 0, 0);

  const bm = new fabric.Image(cv, {
    left: 0, top: 0,
    originX: "left", originY: "top",
    objectCaching: false,
    noScaleCache: true,
    selectable: true,
    evented: true,
  });
  bm._vecSourceEl = element;
  bm._vecMeta = { w, h };
  return bm;
}

// Grupo de texto con pseudo-relieve (sombra + luz)
function makeTextGroup(text, opts = {}) {
  const base = new fabric.Textbox(text, {
    ...opts,
    originX: "center", originY: "center",
    selectable: false, evented: false,
    objectCaching: false, shadow: null, stroke: null,
    fill: "rgba(35,35,35,1)", globalCompositeOperation: "multiply"
  });
  const shadow = new fabric.Textbox(text, {
    ...opts,
    originX: "center", originY: "center",
    left: -1, top: -1,
    selectable: false, evented: false,
    objectCaching: false, fill: "",
    stroke: "rgba(0,0,0,0.48)", strokeWidth: 1,
    globalCompositeOperation: "multiply"
  });
  const highlight = new fabric.Textbox(text, {
    ...opts,
    originX: "center", originY: "center",
    left: +1, top: +1,
    selectable: false, evented: false,
    objectCaching: false, fill: "",
    stroke: "rgba(255,255,255,0.65)", strokeWidth: 0.6,
    globalCompositeOperation: "screen"
  });

  const group = new fabric.Group([shadow, highlight, base], {
    originX: "center", originY: "center",
    subTargetCheck: false,
    objectCaching: false,
    selectable: true, evented: true,
    scaleX: 1, scaleY: 1
  });
  group._kind = "textGroup";
  group._textChildren = { shadow, highlight, base };

  const sync = () => {
    const sx = Math.max(1e-6, Math.abs(group.scaleX || 1));
    const sy = Math.max(1e-6, Math.abs(group.scaleY || 1));
    const ox = 1 / sx, oy = 1 / sy;
    shadow.set({ left: -ox, top: -oy });
    highlight.set({ left: +ox, top: +oy });
    group.setCoords();
    group.canvas?.requestRenderAll?.();
  };
  group.on("scaling",  sync);
  group.on("modified", sync);
  sync();
  return group;
}

// Grupo imagen con relieve simple (doble capa: sombra + luz)
function attachDebossToBase(c, baseObj, { offset = 1 } = {}) {
  const cloneFrom = () => {
    const el = typeof baseObj.getElement === "function" ? baseObj.getElement() : baseObj._element;
    return new fabric.Image(el, {
      originX: "center", originY: "center",
      objectCaching: false, noScaleCache: true, selectable: false, evented: false,
    });
  };

  const base = cloneFrom();
  const shadow = cloneFrom();
  const highlight = cloneFrom();

  const group = new fabric.Group([shadow, highlight, base], {
    originX: "center", originY: "center",
    objectCaching: false, selectable: true, evented: true,
    subTargetCheck: false,
  });
  group._kind = "imgGroup";
  group._imgChildren = { base, shadow, highlight };
  group._debossOffset = offset;

  const srcEl = typeof baseObj.getElement === "function" ? baseObj.getElement() : baseObj._element;
  const applyElement = (img) => {
    base.setElement(img); shadow.setElement(img); highlight.setElement(img);
  };
  applyElement(srcEl);

  shadow.set({ globalCompositeOperation: "multiply", opacity: 1 });
  highlight.set({ globalCompositeOperation: "screen", opacity: 1 });

  const normalizeImgOffsets = () => {
    const sx = Math.max(1e-6, Math.abs(group.scaleX || 1));
    const sy = Math.max(1e-6, Math.abs(group.scaleY || 1));
    const ox = group._debossOffset / sx;
    const oy = group._debossOffset / sy;
    shadow.set({ left: -ox, top: -oy });
    highlight.set({ left: +ox, top: +oy });
    base.set({ left: 0, top: 0 });
    group.setCoords?.();
    group.canvas?.requestRenderAll?.();
  };
  group._debossSync = normalizeImgOffsets;

  group.on("scaling", normalizeImgOffsets);
  group.on("modified", normalizeImgOffsets);
  normalizeImgOffsets();

  return group;
}

function updateDebossVisual(obj, { offset }) {
  const g = obj && obj._kind === "imgGroup" ? obj : null;
  if (!g) return;
  g._debossOffset = offset;

  const { shadow, highlight } = g._imgChildren || {};
  if (!shadow || !highlight) return;

  const sx = Math.max(1e-6, Math.abs(g.scaleX || 1));
  const sy = Math.max(1e-6, Math.abs(g.scaleY || 1));
  const ox = g._debossOffset / sx;
  const oy = g._debossOffset / sy;
  shadow.set({ left: -ox, top: -oy });
  highlight.set({ left: +ox, top: +oy });
  g.setCoords();
  g.canvas?.requestRenderAll?.();
}

// ============================================================
// Componente principal
// ============================================================
export default function CustomizationOverlay({
  stageRef,
  anchorRef,
  visible = true,
  zoom = 0.6,
  setZoom,
}) {
  // ---- Refs y estado ----
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const overlayRef = useRef(null);
  const addInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const menuRef = useRef(null);

  const [uploadMode, setUploadMode] = useState(null); // "vector" | "rgb"
  const [baseSize, setBaseSize] = useState({ w: 1, h: 1 });
  const [overlayBox, setOverlayBox] = useState({ left: 0, top: 0, w: 1, h: 1 });
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [selType, setSelType] = useState("none"); // 'none'|'text'|'image'

  // Tipografía
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].css);
  const [fontSize, setFontSize] = useState(60);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState("center");

  const [showAlignMenu, setShowAlignMenu] = useState(false);

  // Color (para texto y vector; no afecta RGB)
  const [shapeColor, setShapeColor] = useState("#333333");

  // Vector/relieve
  const [vecOffset, setVecOffset] = useState(1);   // 0..5
  const [vecInvert, setVecInvert] = useState(false); // oscuro/claro
  const [vecBias, setVecBias] = useState(0);       // -60..+60

  const [textEditing, setTextEditing] = useState(false);
  const suppressSelectionRef = useRef(false);
  const designBoundsRef = useRef(null);

  // ---- Zoom CSS en el stage ----
  useEffect(() => {
    const v = typeof zoom === "number" ? zoom : 0.6;
    stageRef?.current?.style.setProperty("--zoom", String(v));
  }, [zoom, stageRef]);

  // ---- Layout: medir anchor y stage ----
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
        top  += el.offsetTop  || 0;
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

  // ---- Inicializar Fabric ----
  useEffect(() => {
    if (!visible || !canvasRef.current || fabricCanvasRef.current) return;

    const c = new fabric.Canvas(canvasRef.current, {
      width: 1,
      height: 1,
      preserveObjectStacking: true,
      selection: true,
      perPixelTargetFind: true,
      targetFindTolerance: 8,
    });
    fabricCanvasRef.current = c;

    // Área de diseño con un pequeño margen
    const setDesignBounds = ({ x, y, w, h }) => { designBoundsRef.current = { x, y, w, h }; };
    const clampObjectToBounds = (obj) => {
      const b = designBoundsRef.current; if (!b || !obj) return;
      obj.setCoords();
      const r = obj.getBoundingRect(true);
      let dx = 0, dy = 0;
      if (r.left < b.x) dx = b.x - r.left;
      if (r.top  < b.y) dy = b.y - r.top;
      if (r.left + r.width  > b.x + b.w) dx = (b.x + b.w) - (r.left + r.width);
      if (r.top  + r.height > b.y + b.h) dy = (b.y + b.h) - (r.top  + r.height);
      if (dx || dy) {
        obj.left = (obj.left ?? 0) + dx;
        obj.top  = (obj.top  ?? 0) + dy;
        obj.setCoords();
      }
    };

    setDesignBounds({ x: 10, y: 10, w: c.getWidth() - 20, h: c.getHeight() - 20 });

    const __bounds_onMove   = (e) => clampObjectToBounds(e.target);
    const __bounds_onScale  = (e) => clampObjectToBounds(e.target);
    const __bounds_onRotate = (e) => clampObjectToBounds(e.target);
    const __bounds_onAdded  = (e) => clampObjectToBounds(e.target);
    c.on("object:moving",   __bounds_onMove);
    c.on("object:scaling",  __bounds_onScale);
    c.on("object:rotating", __bounds_onRotate);
    c.on("object:added",    __bounds_onAdded);

    const __bounds_ro = new ResizeObserver(() => {
      const cw = c.getWidth(), ch = c.getHeight();
      setDesignBounds({ x: 10, y: 10, w: cw - 20, h: ch - 20 });
      const a = c.getActiveObject(); if (a) clampObjectToBounds(a);
    });
    __bounds_ro.observe(c.upperCanvasEl);

    // Selección/estado
    const classify = (a) => {
      if (!a) return "none";
      if (a._kind === "imgGroup")  return "image";
      if (a._kind === "textGroup") return "text";
      if (a.type === "activeSelection" && a._objects?.length) {
        if (a._objects.every(o => o._kind === "textGroup")) return "text";
        if (a._objects.some(o => o._kind === "imgGroup"))    return "image";
        return "none";
      }
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

    setReady(true);

    return () => {
      c.off("selection:created", onSel);
      c.off("selection:updated", onSel);
      c.off("selection:cleared");
      c.off("object:moving",   __bounds_onMove);
      c.off("object:scaling",  __bounds_onScale);
      c.off("object:rotating", __bounds_onRotate);
      c.off("object:added",    __bounds_onAdded);
      try { __bounds_ro.disconnect(); } catch {}
      try { c.dispose(); } catch {}
      fabricCanvasRef.current = null;
    };
  }, [visible]);

  // Ajuste de tamaño si cambia el contenedor
  useEffect(() => {
    const c = fabricCanvasRef.current;
    if (!c) return;
    c.setWidth(baseSize.w);
    c.setHeight(baseSize.h);
    c.calcOffset?.();
    c.requestRenderAll?.();
  }, [baseSize.w, baseSize.h]);

  // Interactividad según modo
  useEffect(() => {
    const c = fabricCanvasRef.current;
    if (!c) return;

    const enableNode = (o, on) => {
      if (!o) return;
      const isGroup = o._kind === "imgGroup" || o._kind === "textGroup";
      o.selectable   = on;
      o.evented      = on;
      o.lockMovementX = !on;
      o.lockMovementY = !on;
      o.hasControls  = on;
      o.hasBorders   = on;
      if (!isGroup && (o.type === "i-text" || typeof o.enterEditing === "function")) o.editable = on;
      o.hoverCursor  = on ? "move" : "default";
      if (isGroup) return;
      const children = o._objects || (typeof o.getObjects === "function" ? o.getObjects() : null);
      if (Array.isArray(children)) children.forEach(ch => enableNode(ch, on));
    };

    const setAll = (on) => {
      c.skipTargetFind = !on;
      c.selection = on;
      (c.getObjects?.() || []).forEach(o => enableNode(o, on));
      const upper = c.upperCanvasEl;
      const lower = c.lowerCanvasEl;
      if (upper) { upper.style.pointerEvents = on ? "auto" : "none"; upper.style.touchAction = on ? "none" : "auto"; upper.tabIndex = on ? 0 : -1; }
      if (lower) { lower.style.pointerEvents = "none"; lower.style.touchAction = "none"; }
      c.defaultCursor = on ? "move" : "default";
      try { c.discardActiveObject(); } catch {}
      c.calcOffset?.();
      c.requestRenderAll?.();
      setTimeout(() => { c.calcOffset?.(); c.requestRenderAll?.(); }, 0);
    };

    setAll(!!editing);
  }, [editing]);

  // ------------------------------------------------------------
  // Acciones
  // ------------------------------------------------------------
  const addText = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    const group = makeTextGroup("Nuevo párrafo", {
      width: Math.min(baseSize.w * 0.9, 220),
      fontSize, fontFamily, fontWeight: isBold ? "700" : "normal",
      fontStyle: isItalic ? "italic" : "normal",
      underline: isUnderline, textAlign,
    });
    group.set({ left: baseSize.w / 2, top: baseSize.h / 2, originX: "center", originY: "center" });
    c.add(group);
    c.setActiveObject(group);
    setSelType("text");
    c.requestRenderAll();
    setEditing(true);
  };

  // Subir como VECTOR (permite color)
  const addVectorFromFile = (file) => {
    const c = fabricCanvasRef.current; if (!c || !file) return;
    const url = URL.createObjectURL(file);
    const imgEl = new Image(); imgEl.crossOrigin = "anonymous";
    imgEl.onload = () => {
      const src = downscale(imgEl);
      const [r,g,b] = hexToRgb(shapeColor);
      const baseImg = vectorizeElementToBitmap(src, {
        maxDim: VECTOR_SAMPLE_DIM,
        makeDark: !vecInvert,
        drawColor: [r,g,b],
        thrBias: vecBias
      });
      if (!baseImg) { URL.revokeObjectURL(url); return; }
      const maxW = c.getWidth() * 0.8, maxH = c.getHeight() * 0.8;
      const s = Math.min(maxW / (baseImg._vecMeta?.w || 1), maxH / (baseImg._vecMeta?.h || 1));
      baseImg.set({
        originX: "center", originY: "center",
        left: c.getWidth()/2, top: c.getHeight()/2,
        scaleX: s, scaleY: s,
        selectable: false, evented: false, objectCaching: false
      });
      const group = attachDebossToBase(c, baseImg, { offset: vecOffset });
      c.add(group);
      c.setActiveObject(group);
      setSelType("image");
      c.requestRenderAll();
      setEditing(true);
      URL.revokeObjectURL(url);
    };
    imgEl.onerror = () => URL.revokeObjectURL(url);
    imgEl.src = url;
  };

  // Subir como RGB (no aplica color)
  const addRgbFromFile = (file) => {
    const c = fabricCanvasRef.current; if (!c || !file) return;
    const url = URL.createObjectURL(file);
    fabric.Image.fromURL(url, (img) => {
      if (!img) { URL.revokeObjectURL(url); return; }
      // Limitar tamaño
      const src = downscale(img.getElement());
      const bitmap = new fabric.Image(src, {
        originX: "center", originY: "center",
        objectCaching: false, noScaleCache: true,
        selectable: true, evented: true
      });
      const maxW = c.getWidth() * 0.8, maxH = c.getHeight() * 0.8;
      const s = Math.min(maxW / (src.width || 1), maxH / (src.height || 1));
      bitmap.set({
        left: c.getWidth()/2, top: c.getHeight()/2,
        scaleX: s, scaleY: s
      });
      c.add(bitmap);
      c.setActiveObject(bitmap);
      setSelType("image");
      c.requestRenderAll();
      setEditing(true);
      URL.revokeObjectURL(url);
    }, { crossOrigin: "anonymous" });
  };

  // Reemplazar activo (mantiene pose)
  const replaceActiveFromFile = (file) => {
    const c = fabricCanvasRef.current; if (!c || !file) return;
    const active = c.getActiveObject(); if (!active) return;
    const url = URL.createObjectURL(file);
    const pose = {
      left: active.left, top: active.top,
      originX: active.originX, originY: active.originY,
      scaleX: active.scaleX, scaleY: active.scaleY, angle: active.angle || 0
    };

    if (active._kind === "imgGroup") {
      // Reemplazar grupo vectorizado
      const imgEl = new Image(); imgEl.crossOrigin = "anonymous";
      imgEl.onload = () => {
        const src = downscale(imgEl);
        const [r,g,b] = hexToRgb(shapeColor);
        const baseImg = vectorizeElementToBitmap(src, {
          maxDim: VECTOR_SAMPLE_DIM,
          makeDark: !vecInvert,
          drawColor: [r,g,b],
          thrBias: vecBias
        });
        if (!baseImg) { URL.revokeObjectURL(url); return; }
        baseImg.set({ selectable: false, evented: false, objectCaching: false });
        try { c.remove(active); } catch {}
        const group = attachDebossToBase(c, baseImg, { offset: vecOffset });
        group.set(pose);
        c.add(group);
        c.setActiveObject(group);
        setSelType("image");
        c.requestRenderAll();
        setEditing(true);
        URL.revokeObjectURL(url);
      };
      imgEl.onerror = () => URL.revokeObjectURL(url);
      imgEl.src = url;
    } else {
      // Reemplazar imagen RGB
      fabric.Image.fromURL(url, (img) => {
        if (!img) { URL.revokeObjectURL(url); return; }
        const src = downscale(img.getElement());
        const bitmap = new fabric.Image(src, {
          originX: "center", originY: "center",
          objectCaching: false, noScaleCache: true,
          selectable: true, evented: true
        });
        try { c.remove(active); } catch {}
        bitmap.set(pose);
        c.add(bitmap);
        c.setActiveObject(bitmap);
        setSelType("image");
        c.requestRenderAll();
        setEditing(true);
        URL.revokeObjectURL(url);
      }, { crossOrigin: "anonymous" });
    }
  };

  // Borrar selección
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

  // Color para texto o vector (no RGB)
  const applyColorToActive = (hex) => {
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;
    const [r, g, b] = hexToRgb(hex);

    const paintVectorGroup = (g) => {
      if (!g || g._kind !== "imgGroup") return false;
      const base = g._imgChildren?.base;
      if (!base) return false;
      const el = base._vecSourceEl || (typeof base.getElement === "function" ? base.getElement() : base._element);
      if (!el) return false;
      const vec = vectorizeElementToBitmap(el, {
        maxDim: VECTOR_SAMPLE_DIM,
        makeDark: !vecInvert,
        drawColor: [r,g,b],
        thrBias: vecBias
      });
      if (!vec) return false;
      vec.set({ selectable: false, evented: false, objectCaching: false });
      const pose = { left: g.left, top: g.top, originX: g.originX, originY: g.originY, scaleX: g.scaleX, scaleY: g.scaleY, angle: g.angle || 0 };
      try { c.remove(g); } catch {}
      const group = attachDebossToBase(c, vec, { offset: vecOffset });
      group.set(pose);
      c.add(group);
      c.setActiveObject(group);
      return true;
    };

    if (a._kind === "imgGroup") {
      if (paintVectorGroup(a)) c.requestRenderAll();
      return;
    }
    if (a.type === "activeSelection" && a._objects?.length) {
      let any = false;
      a._objects.slice().forEach(o => { if (o._kind === "imgGroup") { any = paintVectorGroup(o) || any; } });
      if (any) c.requestRenderAll();
      return;
    }

    // Texto (grupo)
    if (a._kind === "textGroup") {
      const { base } = a._textChildren || {};
      if (base) {
        base.set({ fill: `rgb(${r},${g},${b})` });
        a.canvas?.requestRenderAll?.();
      }
      return;
    }

    // Texto suelto
    if (a.type === "textbox" || a.type === "i-text" || a.type === "text") {
      a.set({ fill: `rgb(${r},${g},${b})` });
      a.canvas?.requestRenderAll?.();
      return;
    }

    // Imágenes RGB: ignorar color
  };

  // Aplicar cambios tipográficos a selección (texto)
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

  // Re-vectorizar al cambiar parámetros (bias/invert) con selección vector
  useEffect(() => {
    if (!editing || selType !== "image") return;
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;

    const rebuild = (obj) => {
      let element = null;
      let pose = null;

      if (obj?._kind === "imgGroup") {
        const base = obj._imgChildren?.base;
        if (!base) return;
        element = base._vecSourceEl || (typeof base.getElement === "function" ? base.getElement() : base._element);
        pose = { left: obj.left, top: obj.top, originX: obj.originX, originY: obj.originY, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle || 0 };
        try { obj.canvas.remove(obj); } catch {}
      } else if (obj?._vecSourceEl || obj?.type === "image") {
        // RGB → no re-vectorizamos
        return;
      } else {
        return;
      }

      const [r,g,b] = hexToRgb(shapeColor);
      const baseImg = vectorizeElementToBitmap(element, { maxDim: VECTOR_SAMPLE_DIM, makeDark: !vecInvert, drawColor: [r,g,b], thrBias: vecBias });
      if (!baseImg) return;
      baseImg.set({ selectable: false, evented: false, objectCaching: false });

      const group = attachDebossToBase(c, baseImg, { offset: vecOffset });
      group.set(pose);
      c.add(group);
      c.setActiveObject(group);
    };

    if (a.type === "activeSelection" && a._objects?.length) {
      const arr = a._objects.slice(); a.discard(); arr.forEach(rebuild);
    } else { rebuild(a); }

    c.requestRenderAll();
  }, [vecBias, vecInvert]); // vecOffset se trata aparte

  // Offset de relieve en caliente
  useEffect(() => {
    if (!editing || selType !== "image") return;
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;
    const upd = (obj) => { if (obj._kind === "imgGroup") updateDebossVisual(obj, { offset: vecOffset }); };
    if (a.type === "activeSelection" && a._objects?.length) a._objects.forEach(upd); else upd(a);
  }, [vecOffset, editing, selType]);

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  if (!visible) return null;

const OverlayCanvas = (
  <div
    ref={overlayRef}
    style={{
      position: "absolute",
      inset: 0,
      zIndex: Z_CANVAS,
      overflow: "visible",
      pointerEvents: "auto",
      touchAction: "none",
    }}
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
      }}
    />
  </div>
);


  function Menu() {
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
        {/* Línea 1: Zoom + modos */}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {typeof setZoom === "function" && (
            <div className="input-group input-group-sm" style={{ width: 180 }}>
              <span className="input-group-text">Zoom</span>
              <button type="button" className="btn btn-outline-secondary"
                onClick={() => setZoom(z => Math.max(0.8, +(z - 0.1).toFixed(2)))}>−</button>
              <input type="text" readOnly className="form-control form-control-sm text-center"
                value={`${Math.round((zoom || 1) * 100)}%`} />
              <button type="button" className="btn btn-outline-secondary"
                onClick={() => setZoom(z => Math.min(2.5, +(z + 0.1).toFixed(2)))}>+</button>
            </div>
          )}

          <button
            type="button"
            className={`btn ${!editing ? "btn-dark" : "btn-outline-secondary"} text-nowrap`}
            onMouseDown={(e)=>e.preventDefault()}
            onPointerDown={(e)=>e.stopPropagation()}
            onClick={() => { suppressSelectionRef.current = true; setEditing(false); setTimeout(() => { suppressSelectionRef.current = false; }, 150); }}
            style={{ minWidth: "16ch" }}
          >
            Seleccionar Maceta
          </button>

          <button
            type="button"
            className={`btn ${editing ? "btn-dark" : "btn-outline-secondary"} text-nowrap`}
            onMouseDown={(e)=>e.preventDefault()}
            onPointerDown={(e)=>e.stopPropagation()}
            onClick={() => { suppressSelectionRef.current = true; setEditing(true); setTimeout(() => { suppressSelectionRef.current = false; }, 150); }}
            style={{ minWidth: "12ch" }}
          >
            Diseñar
          </button>
        </div>

        {/* Línea 2: Acciones básicas */}
        {editing && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <button type="button" className="btn btn-sm btn-outline-secondary"
              onPointerDown={(e)=>e.stopPropagation()}
              onClick={addText}
              disabled={!ready}
              title="Agregar texto"
            >
              <i className="fa-regular fa-font"></i> <span className="ms-1">Texto</span>
            </button>

            {/* Vectorizada (usa sistema de vectorización DOBO) */}
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onPointerDown={(e)=>e.stopPropagation()}
              onClick={() => { setUploadMode("vector"); addInputRef.current?.click(); }}
              disabled={!ready}
              title="Subir imagen vectorizada (monocolor)"
            >
              <i className="fa-regular fa-shapes"></i> <span className="ms-1">Vector</span>
            </button>

            {/* RGB (fotográfica) */}
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onPointerDown={(e)=>e.stopPropagation()}
              onClick={() => { setUploadMode("rgb"); addInputRef.current?.click(); }}
              disabled={!ready}
              title="Subir imagen RGB"
            >
              <i className="fa-regular fa-image"></i> <span className="ms-1">RGB</span>
            </button>

            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onPointerDown={(e)=>e.stopPropagation()}
              onClick={onDelete}
              disabled={!ready || selType === "none"}
              title="Eliminar seleccionado"
            >
              <i className="fa-regular fa-trash-can"></i> <span className="ms-1">Borrar</span>
            </button>
          </div>
        )}

        {/* Línea 3: Propiedades por tipo */}
        {editing && (
          <>
            {selType === "text" && (
              <>
                <div className="input-group input-group-sm" style={{ maxWidth: 150, marginBottom: 6 }}>
                  <span className="input-group-text">Color</span>
                  <input
                    type="color"
                    className="form-control form-control-color"
                    value={shapeColor}
                    onChange={(e)=>{ setShapeColor(e.target.value); applyColorToActive(e.target.value); }}
                    onPointerDown={(e)=>e.stopPropagation()}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                  <div className="input-group input-group-sm" style={{ maxWidth: 220 }}>
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
                      type="button"
                      className={`btn ${isBold ? "btn-dark" : "btn-outline-secondary"}`}
                      onPointerDown={(e)=>e.stopPropagation()}
                      onClick={() => { const nv = !isBold; setIsBold(nv); applyToSelection(o => o.set({ fontWeight: nv ? "700" : "normal" })); }}
                    >
                      B
                    </button>
                    <button
                      type="button"
                      className={`btn ${isItalic ? "btn-dark" : "btn-outline-secondary"}`}
                      onPointerDown={(e)=>e.stopPropagation()}
                      onClick={() => { const nv = !isItalic; setIsItalic(nv); applyToSelection(o => o.set({ fontStyle: nv ? "italic" : "normal" })); }}
                    >
                      I
                    </button>
                    <button
                      type="button"
                      className={`btn ${isUnderline ? "btn-dark" : "btn-outline-secondary"}`}
                      onPointerDown={(e)=>e.stopPropagation()}
                      onClick={() => { const nv = !isUnderline; setIsUnderline(nv); applyToSelection(o => o.set({ underline: nv })); }}
                    >
                      U
                    </button>
                  </div>

                  <div className="input-group input-group-sm" style={{ width: 160 }}>
                    <span className="input-group-text">Tamaño</span>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      min={8}
                      max={200}
                      step={1}
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
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onPointerDown={(e)=>e.stopPropagation()}
                      onClick={() => setShowAlignMenu(v => !v)}
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

            {selType === "image" && (
              <>
                {/* Si es vector, color habilitado; si es RGB, lo deshabilitamos */}
                <div className="input-group input-group-sm" style={{ width: 170, marginBottom: 6 }}>
                  <span className="input-group-text">Color</span>
                  <input
                    type="color"
                    className="form-control form-control-color"
                    value={shapeColor}
                    onChange={(e)=>{ setShapeColor(e.target.value); applyColorToActive(e.target.value); }}
                    onPointerDown={(e)=>e.stopPropagation()}
                    disabled={(() => {
                      const c = fabricCanvasRef.current; if (!c) return true;
                      const a = c.getActiveObject();
                      if (!a) return true;
                      if (a._kind === "imgGroup") return false; // vector
                      if (a.type === "activeSelection" && a._objects?.length) {
                        // Si todos son grupos vector, permitimos
                        return !a._objects.every(x => x._kind === "imgGroup");
                      }
                      return true; // RGB normal → deshabilitar
                    })()}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <div className="input-group input-group-sm" style={{ width: 230 }}>
                    <span className="input-group-text">Detalles</span>
                    <button type="button" className="btn btn-outline-secondary" onPointerDown={(e)=>e.stopPropagation()} onClick={() => setVecBias(v => clamp(v - 5, -60, 60))}>−</button>
                    <input type="text" readOnly className="form-control form-control-sm text-center" value={vecBias} />
                    <button type="button" className="btn btn-outline-secondary" onPointerDown={(e)=>e.stopPropagation()} onClick={() => setVecBias(v => clamp(v + 5, -60, 60))}>+</button>
                  </div>

                  <div className="input-group input-group-sm" style={{ width: 190 }}>
                    <span className="input-group-text">Profundidad</span>
                    <button type="button" className="btn btn-outline-secondary" onPointerDown={(e)=>e.stopPropagation()} onClick={() => setVecOffset(v => clamp(v - 1, 0, 5))}>−</button>
                    <input type="text" readOnly className="form-control form-control-sm text-center" value={vecOffset} />
                    <button type="button" className="btn btn-outline-secondary" onPointerDown={(e)=>e.stopPropagation()} onClick={() => setVecOffset(v => clamp(v + 1, 0, 5))}>+</button>
                  </div>

                  <div className="btn-group btn-group-sm" role="group" aria-label="Invertir">
                    <button type="button" className={`btn ${!vecInvert ? "btn-dark" : "btn-outline-secondary"}`} onPointerDown={(e)=>e.stopPropagation()} onClick={() => setVecInvert(false)}>Oscuro</button>
                    <button type="button" className={`btn ${vecInvert ? "btn-dark" : "btn-outline-secondary"}`} onPointerDown={(e)=>e.stopPropagation()} onClick={() => setVecInvert(true)}>Claro</button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Inputs ocultos */}
        <input
          ref={addInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (uploadMode === "vector") addVectorFromFile(f);
              else addRgbFromFile(f);
            }
            e.target.value = "";
          }}
          onPointerDown={(e)=>e.stopPropagation()}
          style={{ display: "none" }}
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceActiveFromFile(f); e.target.value=""; }}
          onPointerDown={(e)=>e.stopPropagation()}
          style={{ display: "none" }}
        />
      </div>
    );
  }

return (
  <>
    {createPortal(OverlayCanvas, stageRef?.current || document.body)}
    {anchorRef?.current ? createPortal(
      <div style={{
        position: "relative",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        marginTop: 8,
        zIndex: Z_CANVAS + 1
      }}>
        <div style={{ pointerEvents: "auto", display: "inline-flex" }}>
          <Menu />
        </div>
      </div>,
      document.getElementById("dobo-menu-dock") || document.body
    ) : null}
   </>
  );
}


