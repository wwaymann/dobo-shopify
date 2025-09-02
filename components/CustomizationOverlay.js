// components/CustomizationOverlay.js
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { createPortal } from "react-dom";

/** ===== Constantes ===== */
const MAX_TEXTURE_DIM = 1600;
const VECTOR_SAMPLE_DIM = 500;
const Z_CANVAS = 4000;
const Z_MENU = 10000;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const FONT_OPTIONS = [
  { name: "Arial", css: "Arial, Helvetica, sans-serif" },
  { name: "Georgia", css: "Georgia, serif" },
  { name: "Times New Roman", css: '"Times New Roman", Times, serif' },
  { name: "Courier New", css: '"Courier New", Courier, monospace' },
  { name: "Trebuchet MS", css: '"Trebuchet MS", Tahoma, sans-serif' },
  { name: "Montserrat", css: "Montserrat, Arial, sans-serif" },
  { name: "Poppins", css: "Poppins, Arial, sans-serif" },
];

export default function CustomizationOverlay({
  stageRef,   // contenedor escalado (opcional, sólo para zoom externo)
  anchorRef,  // elemento que cubre el overlay (carrusel de macetas)
  visible = true,
  zoom,       // opcional
  setZoom,    // opcional
}) {
  /** ----- Refs/estado ----- */
  const canvasWrapRef = useRef(null);
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);

  const addInputRef = useRef(null);
  const replaceInputRef = useRef(null);

  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [selType, setSelType] = useState("none");

  // tamaño del anchor (el overlay se ajusta 1:1 aquí)
  const [baseSize, setBaseSize] = useState({ w: 1, h: 1 });

  // tipografía
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].css);
  const [fontSize, setFontSize] = useState(60);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState("center");
  const [showAlignMenu, setShowAlignMenu] = useState(false);

  // imagen/relieve
  const [vecOffset, setVecOffset] = useState(1);
  const [vecInvert, setVecInvert] = useState(false);
  const [vecBias, setVecBias] = useState(0);

  // zoom local (si no te pasan por props)
  const [localZoom, setLocalZoom] = useState(1);
  const getZoom = () => (typeof zoom === "number" ? zoom : localZoom);
  const setZoomValue = (z) => {
    const val = clamp(z, 0.8, 2.5);
    if (typeof setZoom === "function") setZoom(val);
    else {
      const s = stageRef?.current;
      if (s) s.style.setProperty("--zoom", String(val));
      setLocalZoom(val);
    }
  };

  /** ===== Medición directa del anchor ===== */
  useLayoutEffect(() => {
    const el = anchorRef?.current;
    if (!el) return;
    // Garantiza posición para el overlay absoluto interno
    const prev = el.style.position;
    if (getComputedStyle(el).position === "static") el.style.position = "relative";

    const measure = () => {
      const w = Math.max(1, Math.round(el.clientWidth));
      const h = Math.max(1, Math.round(el.clientHeight));
      setBaseSize({ w, h });
    };
    measure();

    const ro = new ResizeObserver(measure);
    try { ro.observe(el); } catch {}
    window.addEventListener("resize", measure);
    return () => {
      try { ro.disconnect(); } catch {}
      window.removeEventListener("resize", measure);
      try { el.style.position = prev; } catch {}
    };
  }, [anchorRef]);

  /** ===== Helpers Imagen ===== */
  const downscale = (imgEl) => {
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
  };

  const otsuThreshold = (gray, total) => {
    const hist = new Uint32Array(256);
    for (let i = 0; i < total; i++) hist[gray[i]]++;
    let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, wB = 0, varMax = -1, threshold = 127;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue;
      const wF = total - wB; if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF, diff = mB - mF;
      const between = wB * wF * diff * diff;
      if (between > varMax) { varMax = between; threshold = t; }
    }
    return threshold;
  };

  const vectorizeElementToBitmap = (element, { maxDim = VECTOR_SAMPLE_DIM, makeDark = true, drawColor = [51, 51, 51], thrBias = 0 } = {}) => {
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

    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data, total = w * h;
    const gray = new Uint8Array(total);
    for (let i = 0, j = 0; j < total; i += 4, j++) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      gray[j] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
    const thr = clamp(otsuThreshold(gray, total) + thrBias, 0, 255);
    for (let j = 0, i = 0; j < total; j++, i += 4) {
      const keep = makeDark ? (gray[j] <= thr) : (gray[j] > thr);
      if (keep) { data[i] = drawColor[0]; data[i + 1] = drawColor[1]; data[i + 2] = drawColor[2]; data[i + 3] = 255; }
      else { data[i + 3] = 0; }
    }
    ctx.putImageData(img, 0, 0);
    return new fabric.Image(cv, { originX: "left", originY: "top", objectCaching: false, noScaleCache: true, selectable: true, evented: true });
  };

  /** ===== Util: centrar en el canvas ===== */
  const centerOnCanvas = (obj, c) => {
    const cx = c.getWidth() / 2;
    const cy = c.getHeight() / 2;
    obj.set({ originX: "center", originY: "center" });
    obj.setPositionByOrigin(new fabric.Point(cx, cy), "center", "center");
    obj.setCoords?.();
  };

  /** ===== Grupos de relieve (capas pegadas + offsets normalizados) ===== */
  const normalizeImageOffsets = (group) => {
    if (!group || group._kind !== "imgDeboss") return;
    const { shadow, highlight } = group._debossChildren || {};
    if (!shadow || !highlight) return;
    const sx = Math.max(1e-6, Math.abs(group.scaleX || 1));
    const sy = Math.max(1e-6, Math.abs(group.scaleY || 1));
    const ox = vecOffset / sx;
    const oy = vecOffset / sy;
    shadow.set({ left: -ox, top: -oy });
    highlight.set({ left: +ox, top: +oy });
  };

  const normalizeTextOffsets = (group) => {
    if (!group || group._kind !== "textDeboss") return;
    const { shadow, highlight, base } = group._textChildren || {};
    if (!shadow || !highlight || !base) return;
    const sx = Math.max(1e-6, Math.abs(group.scaleX || 1));
    const sy = Math.max(1e-6, Math.abs(group.scaleY || 1));
    const ox = 1 / sx;
    const oy = 1 / sy;
    shadow.set({ left: -ox, top: -oy });
    highlight.set({ left: +ox, top: +oy });
    base.set({ left: 0, top: 0 });
  };

  // Imagen: Group(base, shadow, highlight)
  const makeImageDebossGroup = (element, { scale = 1, angle = 0 } = {}) => {
    const base = vectorizeElementToBitmap(element, { makeDark: !vecInvert, thrBias: vecBias });
    if (!base) return null;
    const shadow = new fabric.Image(base.getElement(), { originX: "left", originY: "top", objectCaching: false, noScaleCache: true, globalCompositeOperation: "multiply" });
    const highlight = new fabric.Image(base.getElement(), { originX: "left", originY: "top", objectCaching: false, noScaleCache: true, globalCompositeOperation: "screen", opacity: 1 });

    // offsets iniciales, se normalizan luego
    shadow.left = -vecOffset; shadow.top = -vecOffset;
    highlight.left = +vecOffset; highlight.top = +vecOffset;
    base.left = 0; base.top = 0;

    const group = new fabric.Group([shadow, highlight, base], {
      angle, scaleX: scale, scaleY: scale, objectCaching: false, selectable: true, evented: true,
    });
    group._kind = "imgDeboss";
    group._vecSourceEl = element;
    group._debossChildren = { shadow, highlight, base };

    // Mantener offsets correctos al escalar/mover
    const sync = () => { normalizeImageOffsets(group); group.setCoords?.(); group.canvas?.requestRenderAll?.(); };
    group.on("scaling", sync);
    group.on("modified", sync);

    return group;
  };

  const revectorizeImageGroup = (group) => {
    if (!group || group._kind !== "imgDeboss" || !group._vecSourceEl) return;
    const c = group.canvas; if (!c) return;
    const center = group.getCenterPoint();
    const { angle, scaleX, scaleY } = group;

    const newBase = vectorizeElementToBitmap(group._vecSourceEl, { makeDark: !vecInvert, thrBias: vecBias });
    if (!newBase) return;
    const newShadow = new fabric.Image(newBase.getElement(), { originX: "left", originY: "top", objectCaching: false, noScaleCache: true, globalCompositeOperation: "multiply" });
    const newHighlight = new fabric.Image(newBase.getElement(), { originX: "left", originY: "top", objectCaching: false, noScaleCache: true, globalCompositeOperation: "screen", opacity: 1 });
    newShadow.left = -vecOffset; newShadow.top = -vecOffset;
    newHighlight.left = +vecOffset; newHighlight.top = +vecOffset;
    newBase.left = 0; newBase.top = 0;

    c.remove(group);
    const fresh = new fabric.Group([newShadow, newHighlight, newBase], {
      angle, scaleX, scaleY, objectCaching: false, selectable: true, evented: true,
    });
    fresh._kind = "imgDeboss";
    fresh._vecSourceEl = group._vecSourceEl;
    fresh._debossChildren = { shadow: newShadow, highlight: newHighlight, base: newBase };
    c.add(fresh);
    fresh.set({ originX: "center", originY: "center" });
    fresh.setPositionByOrigin(center, "center", "center");

    // volver a enganchar normalización
    const sync = () => { normalizeImageOffsets(fresh); fresh.setCoords?.(); c.requestRenderAll?.(); };
    fresh.on("scaling", sync);
    fresh.on("modified", sync);
    sync();

    c.setActiveObject(fresh);
    c.requestRenderAll();
  };

  const updateImageOffset = (group) => {
    if (!group || group._kind !== "imgDeboss") return;
    normalizeImageOffsets(group);
    group.canvas?.requestRenderAll();
  };

  // Texto: Group(shadowText, highlightText, baseText)
  const makeTextDebossGroup = (text, opts) => {
    const base = new fabric.Textbox(text, {
      ...opts,
      fill: "rgba(35,35,35,1)",
      shadow: null, stroke: null, globalCompositeOperation: "multiply",
      selectable: false, evented: false, objectCaching: false,
    });
    const baseOpts = {
      fontFamily: base.fontFamily, fontSize: base.fontSize, fontWeight: base.fontWeight,
      fontStyle: base.fontStyle, underline: base.underline, textAlign: base.textAlign,
      charSpacing: base.charSpacing, width: base.width,
      selectable: false, evented: false, objectCaching: false,
    };
    const shadow = new fabric.Textbox(text, { ...baseOpts, left: -1, top: -1, fill: "", stroke: "rgba(0,0,0,0.48)", strokeWidth: 1, globalCompositeOperation: "multiply" });
    const highlight = new fabric.Textbox(text, { ...baseOpts, left: +1, top: +1, fill: "", stroke: "rgba(255,255,255,0.65)", strokeWidth: 0.6, globalCompositeOperation: "screen" });
    base.left = 0; base.top = 0;

    const group = new fabric.Group([shadow, highlight, base], {
      scaleX: 1, scaleY: 1, objectCaching: false, selectable: true, evented: true,
    });
    group._kind = "textDeboss";
    group._textChildren = { shadow, highlight, base };

    const sync = () => { normalizeTextOffsets(group); group.setCoords?.(); group.canvas?.requestRenderAll?.(); };
    group.on("scaling", sync);
    group.on("modified", sync);
    sync();

    return group;
  };

  const mutateTextGroup = (group, mutator) => {
    if (!group || group._kind !== "textDeboss") return;
    const { shadow, highlight, base } = group._textChildren || {};
    [shadow, highlight, base].forEach((o) => mutator(o));
    normalizeTextOffsets(group);
    group.setCoords?.();
    group.canvas?.requestRenderAll();
  };

  /** ===== Fabric init ===== */
  useEffect(() => {
    if (!visible || !canvasRef.current || fabricCanvasRef.current) return;
    const c = new fabric.Canvas(canvasRef.current, {
      width: 1, height: 1,
      preserveObjectStacking: true,
      selection: true,
      perPixelTargetFind: true,
      targetFindTolerance: 8,
    });
    fabricCanvasRef.current = c;

    const upper = c.upperCanvasEl;
    const lower = c.lowerCanvasEl;
    if (upper) {
      upper.style.position = "absolute";
      upper.style.left = "0";
      upper.style.top = "0";
      upper.style.width = "100%";
      upper.style.height = "100%";
      upper.style.touchAction = "none";
      upper.style.pointerEvents = "auto";
      upper.style.webkitUserSelect = "none";
      upper.style.userSelect = "none";
    }
    if (lower) {
      lower.style.pointerEvents = "none"; // no bloquear clics del host fuera de edición
    }

    // Doble click -> editar texto (sobre el hijo base)
    c.on("mouse:dblclick", (e) => {
      const g = e.target;
      if (!g || g._kind !== "textDeboss") return;
      const { base } = g._textChildren || {};
      if (base && typeof base.enterEditing === "function") {
        base.enterEditing();
        base.selectAll();
        c.requestRenderAll();
      }
    });

    // Clasificar selección
    const classify = (target) => {
      if (!target) return "none";
      if (target._kind === "textDeboss") return "text";
      if (target._kind === "imgDeboss") return "image";
      return "none";
    };

    const reflectTypo = () => {
      const a = c.getActiveObject();
      if (!a || a._kind !== "textDeboss") return;
      const { base } = a._textChildren || {};
      if (!base) return;
      setFontFamily(base.fontFamily || FONT_OPTIONS[0].css);
      setFontSize(base.fontSize || 60);
      setIsBold((base.fontWeight + "" === "700") || base.fontWeight === "bold");
      setIsItalic((base.fontStyle + "" === "italic"));
      setIsUnderline(!!base.underline);
      setTextAlign(base.textAlign || "center");
    };

    const onSel = () => {
      setSelType(classify(c.getActiveObject()));
      reflectTypo();
      c.requestRenderAll();
    };
    c.on("selection:created", onSel);
    c.on("selection:updated", onSel);
    c.on("selection:cleared", () => setSelType("none"));

    setReady(true);

    if (typeof window !== "undefined") {
      window.doboDesignAPI = {
        getCanvas: () => c,
        toPNG: (mult = 3) => c.toDataURL({ format: "png", multiplier: mult, backgroundColor: "transparent" }),
        toSVG: () => c.toSVG({ suppressPreamble: true }),
      };
    }

    return () => {
      c.off("selection:created", onSel);
      c.off("selection:updated", onSel);
      c.off("selection:cleared");
      c.off("mouse:dblclick");
      try { c.dispose(); } catch {}
      fabricCanvasRef.current = null;
    };
  }, [visible]);

  // Ajustar lienzo al tamaño del anchor
  useEffect(() => {
    const c = fabricCanvasRef.current;
    if (!c) return;
    c.setWidth(Math.max(1, Math.round(baseSize.w)));
    c.setHeight(Math.max(1, Math.round(baseSize.h)));
    c.calcOffset?.();
    c.requestRenderAll?.();
  }, [baseSize.w, baseSize.h]);

  /** ===== Alternar modo edición (pointer-events sólo dentro del anchor) ===== */
  useEffect(() => {
    const c = fabricCanvasRef.current;
    if (!c) return;

    const on = !!editing;
    c.skipTargetFind = !on;
    c.selection = on;
    c.defaultCursor = on ? "move" : "default";

    (c.getObjects?.() || []).forEach((o) => {
      o.selectable = on;
      o.evented = on;
      o.lockMovementX = !on;
      o.lockMovementY = !on;
    });

    const upper = c.upperCanvasEl;
    if (upper) {
      upper.style.pointerEvents = on ? "auto" : "none";
      upper.style.touchAction = on ? "none" : "auto";
      upper.tabIndex = on ? 0 : -1;
    }
  }, [editing]);

  /** ===== Zoom (rueda/pinch) sólo en “Diseñar” ===== */
  useEffect(() => {
    const c = fabricCanvasRef.current;
    const upper = c?.upperCanvasEl;
    if (!upper) return;

    const onWheel = (e) => {
      if (!editing) return;
      e.preventDefault();
      const step = e.deltaY > 0 ? -0.08 : 0.08;
      setZoomValue((getZoom() || 1) + step);
    };

    // pinch 2 dedos
    const pts = new Map();
    let startDist = 0, startScale = getZoom() || 1;
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    const onPD = (e) => {
      if (!editing || e.pointerType !== "touch") return;
      upper.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [p1, p2] = [...pts.values()];
        startDist = dist(p1, p2);
        startScale = getZoom() || 1;
      }
    };
    const onPM = (e) => {
      if (!editing || e.pointerType !== "touch" || !pts.has(e.pointerId)) return;
      if (pts.size < 2) return;
      e.preventDefault();
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [p1, p2] = [...pts.values()];
      if (!p1 || !p2 || !startDist) return;
      const factor = dist(p1, p2) / startDist;
      setZoomValue(clamp(startScale * Math.pow(factor, 0.9), 0.8, 2.5));
    };
    const onPU = (e) => {
      if (e.pointerType !== "touch") return;
      pts.delete(e.pointerId);
      if (pts.size < 2) { startDist = 0; startScale = getZoom() || 1; }
    };

    upper.addEventListener("wheel", onWheel, { capture: true, passive: false });
    upper.addEventListener("pointerdown", onPD, { passive: false });
    upper.addEventListener("pointermove", onPM, { passive: false });
    window.addEventListener("pointerup", onPU, { passive: true });
    window.addEventListener("pointercancel", onPU, { passive: true });

    return () => {
      upper.removeEventListener("wheel", onWheel, { capture: true });
      upper.removeEventListener("pointerdown", onPD);
      upper.removeEventListener("pointermove", onPM);
      window.removeEventListener("pointerup", onPU);
      window.removeEventListener("pointercancel", onPU);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, zoom, localZoom]);

  /** ===== Acciones ===== */
  const addText = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    const group = makeTextDebossGroup("Nuevo párrafo", {
      width: Math.min(c.getWidth() * 0.9, 240),
      fontSize, fontFamily, fontWeight: isBold ? "700" : "normal",
      fontStyle: isItalic ? "italic" : "normal",
      underline: isUnderline, textAlign,
      originX: "left", originY: "top",
    });
    if (!group) return;
    c.add(group);
    centerOnCanvas(group, c);
    c.setActiveObject(group);
    c.requestRenderAll();
    setEditing(true);
  };

  const addImageFromFile = (file) => {
    const c = fabricCanvasRef.current; if (!c || !file) return;
    const url = URL.createObjectURL(file);
    const imgEl = new Image(); imgEl.crossOrigin = "anonymous";
    imgEl.onload = () => {
      const src = downscale(imgEl);
      const sample = vectorizeElementToBitmap(src) || new fabric.Image(src);
      const maxW = c.getWidth() * 0.8, maxH = c.getHeight() * 0.8;
      const s = Math.min(maxW / (sample.width || 1), maxH / (sample.height || 1), 1);

      const group = makeImageDebossGroup(src, { scale: s, angle: 0 });
      if (group) {
        c.add(group);
        centerOnCanvas(group, c);
        normalizeImageOffsets(group);
        c.setActiveObject(group);
        c.requestRenderAll();
        setEditing(true);
      }
      URL.revokeObjectURL(url);
    };
    imgEl.onerror = () => URL.revokeObjectURL(url);
    imgEl.src = url;
  };

  const replaceActiveFromFile = (file) => {
    const c = fabricCanvasRef.current; if (!c || !file) return;
    const t = c.getActiveObject();
    if (!t || t._kind !== "imgDeboss") return;
    const url = URL.createObjectURL(file);
    const imgEl = new Image(); imgEl.crossOrigin = "anonymous";
    imgEl.onload = () => {
      const src = downscale(imgEl);
      t._vecSourceEl = src;
      revectorizeImageGroup(t);
      URL.revokeObjectURL(url);
    };
    imgEl.onerror = () => URL.revokeObjectURL(url);
    imgEl.src = url;
  };

  const onDelete = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;
    if (a.type === "activeSelection" && a._objects?.length) {
      const arr = a._objects.slice();
      a.discard();
      arr.forEach((o) => { try { c.remove(o); } catch {} });
    } else {
      try { c.remove(a); } catch {}
    }
    c.discardActiveObject();
    c.requestRenderAll();
    setSelType("none");
  };

  const clearSelectionHard = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    try { c.discardActiveObject(); } catch {}
    try { c.setActiveObject(null); } catch {}
    try { c._activeObject = null; } catch {}
    setSelType("none");
    c.requestRenderAll();
  };
  const enterDesignMode = () => { clearSelectionHard(); setEditing(true); };
  const exitDesignMode = () => { clearSelectionHard(); setEditing(false); };

  // Aplicar a selección (texto)
  const applyToSelection = (mutator) => {
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;
    if (a._kind === "textDeboss") mutateTextGroup(a, mutator);
    a.setCoords?.();
    c.requestRenderAll();
  };

  // Revectorizar imagen al cambiar bias/invert
  useEffect(() => {
    if (!editing || selType !== "image") return;
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject();
    if (a && a._kind === "imgDeboss") revectorizeImageGroup(a);
  }, [vecBias, vecInvert]); // eslint-disable-line

  // Actualizar offset en imagen
  useEffect(() => {
    if (!editing || selType !== "image") return;
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject();
    if (a && a._kind === "imgDeboss") updateImageOffset(a);
  }, [vecOffset, editing, selType]);

  if (!visible) return null;

  /** ===== Overlay pegado al anchor (no tapa otros carrousels) ===== */
  const OverlayCanvas = (
    <div
      ref={canvasWrapRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: Z_CANVAS,
        pointerEvents: editing ? "auto" : "none",
        touchAction: editing ? "none" : "auto",
      }}
    >
      <canvas
        ref={canvasRef}
        width={Math.max(1, Math.round(baseSize.w))}
        height={Math.max(1, Math.round(baseSize.h))}
        style={{ width: "100%", height: "100%", display: "block", background: "transparent" }}
      />
    </div>
  );

  /** ===== Menú ===== */
  function Menu() {
    const zVal = Math.round((getZoom() || 1) * 100);
    return (
      <div
        style={{
          display: "flex", flexDirection: "column", gap: 8,
          background: "rgba(253,253,253,0.34)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
          border: "1px solid #ddd", borderRadius: 12, padding: "10px 12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)", width: "auto", maxWidth: "94vw", fontSize: 12, userSelect: "none",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="input-group input-group-sm" style={{ width: 180 }}>
            <span className="input-group-text">Zoom</span>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setZoomValue((getZoom() || 1) - 0.1)}>−</button>
            <input type="text" readOnly className="form-control form-control-sm text-center" value={`${zVal}%`} />
            <button type="button" className="btn btn-outline-secondary" onClick={() => setZoomValue((getZoom() || 1) + 0.1)}>+</button>
          </div>
          <button
            type="button"
            className={`btn ${!editing ? "btn-dark" : "btn-outline-secondary"} text-nowrap`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={exitDesignMode}
            style={{ minWidth: "16ch" }}
          >
            Seleccionar Maceta
          </button>
          <button
            type="button"
            className={`btn ${editing ? "btn-dark" : "btn-outline-secondary"} text-nowrap`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={enterDesignMode}
            style={{ minWidth: "12ch" }}
          >
            Diseñar
          </button>
        </div>

        {editing && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addText} disabled={!ready}>+ Texto</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => addInputRef.current?.click()} disabled={!ready}>+ Imagen</button>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDelete} disabled={!ready || selType === "none"} title="Eliminar seleccionado">Borrar</button>
          </div>
        )}

        {editing && selType === "text" && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <div className="input-group input-group-sm" style={{ maxWidth: 220 }}>
              <span className="input-group-text">Fuente</span>
              <select className="form-select form-select-sm" value={fontFamily} onChange={(e) => { const v = e.target.value; setFontFamily(v); applyToSelection((o) => o.set({ fontFamily: v })); }}>
                {FONT_OPTIONS.map((f) => <option key={f.name} value={f.css} style={{ fontFamily: f.css }}>{f.name}</option>)}
              </select>
            </div>
            <div className="btn-group btn-group-sm" role="group" aria-label="Estilos">
              <button type="button" className={`btn ${isBold ? "btn-dark" : "btn-outline-secondary"}`}     onClick={() => { const nv = !isBold; setIsBold(nv);     applyToSelection((o) => o.set({ fontWeight: nv ? "700" : "normal" })); }}>B</button>
              <button type="button" className={`btn ${isItalic ? "btn-dark" : "btn-outline-secondary"}`}   onClick={() => { const nv = !isItalic; setIsItalic(nv); applyToSelection((o) => o.set({ fontStyle: nv ? "italic" : "normal" })); }}>I</button>
              <button type="button" className={`btn ${isUnderline ? "btn-dark" : "btn-outline-secondary"}`} onClick={() => { const nv = !isUnderline; setIsUnderline(nv); applyToSelection((o) => o.set({ underline: nv })); }}>U</button>
            </div>
            <div className="input-group input-group-sm" style={{ width: 160 }}>
              <span className="input-group-text">Tamaño</span>
              <input type="number" className="form-control form-control-sm" min={8} max={200} step={1} value={fontSize}
                     onChange={(e) => { const v = clamp(parseInt(e.target.value || "0", 10), 8, 200); setFontSize(v); applyToSelection((o) => o.set({ fontSize: v })); }} />
            </div>
            <div className="btn-group dropup">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowAlignMenu((v) => !v)}>
                {textAlign === "left" ? "⟸" : textAlign === "center" ? "⟺" : textAlign === "right" ? "⟹" : "≣"}
              </button>
              {showAlignMenu && (
                <ul className="dropdown-menu show" style={{ position: "absolute" }}>
                  {["left", "center", "right", "justify"].map((a) => (
                    <li key={a}>
                      <button type="button" className={`dropdown-item ${textAlign === a ? "active" : ""}`} onClick={() => { setTextAlign(a); setShowAlignMenu(false); applyToSelection((o) => o.set({ textAlign: a })); }}>
                        {a}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {editing && selType === "image" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <div className="input-group input-group-sm" style={{ width: 230 }}>
              <span className="input-group-text">Detalles</span>
              <button type="button" className="btn btn-outline-secondary" onClick={() => setVecBias((v) => clamp(v - 5, -60, 60))}>−</button>
              <input type="text" readOnly className="form-control form-control-sm text-center" value={vecBias} />
              <button type="button" className="btn btn-outline-secondary" onClick={() => setVecBias((v) => clamp(v + 5, -60, 60))}>+</button>
            </div>
            <div className="input-group input-group-sm" style={{ width: 190 }}>
              <span className="input-group-text">Profundidad</span>
              <button type="button" className="btn btn-outline-secondary" onClick={() => setVecOffset((v) => clamp(v - 1, 0, 5))}>−</button>
              <input type="text" readOnly className="form-control form-control-sm text-center" value={vecOffset} />
              <button type="button" className="btn btn-outline-secondary" onClick={() => setVecOffset((v) => clamp(v + 1, 0, 5))}>+</button>
            </div>
            <div className="btn-group btn-group-sm" role="group" aria-label="Invertir">
              <button type="button" className={`btn ${!vecInvert ? "btn-dark" : "btn-outline-secondary"}`} onClick={() => setVecInvert(false)}>Oscuro</button>
              <button type="button" className={`btn ${vecInvert ? "btn-dark" : "btn-outline-secondary"}`} onClick={() => setVecInvert(true)}>Claro</button>
            </div>
          </div>
        )}

        {/* Inputs ocultos */}
        <input ref={addInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) addImageFromFile(f); e.target.value = ""; }} style={{ display: "none" }} />
        <input ref={replaceInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceActiveFromFile(f); e.target.value = ""; }} style={{ display: "none" }} />
      </div>
    );
  }

  /** ===== Render ===== */
  return (
    <>
      {/* Ahora el overlay se monta DIRECTO en el anchor (match perfecto y clicks OK) */}
      {anchorRef?.current ? createPortal(OverlayCanvas, anchorRef.current) : null}

      {typeof document !== "undefined"
        ? createPortal(
            <div
              style={{
                position: "fixed",
                left: "50%",
                bottom: 8,
                transform: "translateX(-50%)",
                zIndex: Z_MENU,
                width: "100%",
                display: "flex",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <div style={{ pointerEvents: "auto", display: "inline-flex" }}>
                <Menu />
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
