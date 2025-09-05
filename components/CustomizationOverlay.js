// components/CustomizationOverlay.js
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { createPortal } from 'react-dom';

// ===== Constantes =====
const MAX_TEXTURE_DIM = 1600;
const VECTOR_SAMPLE_DIM = 500;
const Z_CANVAS = 4000;   // overlay de edición sobre la maceta
const Z_MENU   = 10000;  // menú fijo por encima de todo

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Fuentes visibles en el selector
const FONT_OPTIONS = [
  { name: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { name: 'Georgia', css: 'Georgia, serif' },
  { name: 'Times New Roman', css: '"Times New Roman", Times, serif' },
  { name: 'Courier New', css: '"Courier New", Courier, monospace' },
  { name: 'Trebuchet MS', css: '"Trebuchet MS", Tahoma, sans-serif' },
  { name: 'Montserrat', css: 'Montserrat, Arial, sans-serif' },
  { name: 'Poppins', css: 'Poppins, Arial, sans-serif' },
];

export default function CustomizationOverlay({
  stageRef,
  anchorRef,
  visible = true,
  zoom = 1,
  setZoom,
}) {
  // ===== Refs y estado =====
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const overlayRef = useRef(null);

  const addInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const menuRef = useRef(null);

  const [baseSize, setBaseSize] = useState({ w: 1, h: 1 });

  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [selType, setSelType] = useState('none'); // 'none'|'text'|'image'

  // Tipografía
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].css);
  const [fontSize, setFontSize] = useState(60);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState('center');
  const [showAlignMenu, setShowAlignMenu] = useState(false);

  // Imagen/relieve
  const [vecOffset, setVecOffset] = useState(1);     // 0..5
  const [vecInvert, setVecInvert] = useState(false); // oscuro/claro
  const [vecBias, setVecBias] = useState(0);         // -60..+60

  const suppressSelectionRef = useRef(false);
  
  const [anchorRect, setAnchorRect] = useState(null);
  
  const [overlayBox, setOverlayBox] = useState({ left: 0, top: 0, w: 1, h: 1 });

  
  // ===== Layout y medidas =====
  useLayoutEffect(() => {
    const el = anchorRef?.current;
    if (!el) return;
    const prev = el.style.position;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    return () => { try { el.style.position = prev; } catch {} };
  }, [anchorRef]);

  useLayoutEffect(() => {
   const stage = stageRef?.current;
   const anchor = anchorRef?.current;
   if (!stage || !anchor) return;

   const measure = () => {
     const sr = stage.getBoundingClientRect();
     const ar = anchor.getBoundingClientRect();
     const w = Math.max(1, Math.round(anchor.clientWidth));
     const h = Math.max(1, Math.round(anchor.clientHeight));
     const left = Math.max(0, Math.round(ar.left - sr.left));
     const top  = Math.max(0, Math.round(ar.top  - sr.top));
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
   window.addEventListener('resize', measure, { passive: true });
   window.addEventListener('scroll', measure, { passive: true });
   return () => {
     try { roA.disconnect(); } catch {}
     try { roS.disconnect(); } catch {}
     window.removeEventListener('resize', measure);
     window.removeEventListener('scroll', measure);
   };
 }, [stageRef, anchorRef]);
  // Posiciona el menú dentro de la columna de carruseles
  (() => {
    const el = anchorRef?.current;
    if (!el || typeof window === 'undefined') return;
    const update = () => setAnchorRect(el.getBoundingClientRect());
    update();
    const ro = new ResizeObserver(update);
    try { ro.observe(el); } catch {}
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      try { ro.disconnect(); } catch {}
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [anchorRef]);


  
  // ===== Inicializar Fabric =====
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

    // API mínima
    if (typeof window !== 'undefined') {
      window.doboDesignAPI = {
        toPNG: (mult = 3) => c.toDataURL({ format: 'png', multiplier: mult, backgroundColor: 'transparent' }),
        toSVG: () => c.toSVG({ suppressPreamble: true }),
        getCanvas: () => c,
      };
    }

    // Doble clic para editar texto
    c.on('mouse:dblclick', (e) => {
      const t = e.target;
      if (t && (t.type === 'i-text' || t.type === 'textbox' || t.type === 'text') && typeof t.enterEditing === 'function') {
        t.enterEditing();
        c.requestRenderAll();
      }
    });

    // Helpers de tipo
    const isText  = (o) => o && (o.type === 'i-text' || o.type === 'textbox' || o.type === 'text');
    const isImage = (o) => o && o.type === 'image';
    const classify = (a) => {
      if (!a) return 'none';
      if (a.type === 'activeSelection' && a._objects?.length) {
        const arr = a._objects;
        if (arr.every(isText)) return 'text';
        if (arr.some(isImage)) return 'image';
        return 'none';
      }
      if (isText(a)) return 'text';
      if (isImage(a)) return 'image';
      return 'none';
    };
    const reflectTypo = () => {
      const a = c.getActiveObject();
      if (!a) return;
      const first = a.type === 'activeSelection' ? a._objects?.find(isText) : (isText(a) ? a : null);
      if (first) {
        setFontFamily(first.fontFamily || FONT_OPTIONS[0].css);
        setFontSize(first.fontSize || 60);
        setIsBold((first.fontWeight + '' === '700') || first.fontWeight === 'bold');
        setIsItalic((first.fontStyle + '' === 'italic'));
        setIsUnderline(!!first.underline);
        setTextAlign(first.textAlign || 'center');
      }
    };
    const onSel = () => {
  const cobj = c.getActiveObject();

  // Si estamos suprimiendo, descartar lo que venga y no propagar estado
  if (suppressSelectionRef.current) {
    try { if (cobj?.type === 'activeSelection') cobj.discard(); } catch {}
    try { c.discardActiveObject(); } catch {}
    try { c.setActiveObject(null); } catch {}
    try { c._activeObject = null; } catch {}
    setSelType('none');
    c.requestRenderAll();
    return;
  }

  setSelType(classify(cobj));
  reflectTypo();
};
    c.on('selection:created', onSel);
    c.on('selection:updated', onSel);
    c.on('selection:cleared', () => setSelType('none'));

    setReady(true);

    return () => {
      c.off('mouse:dblclick');
      c.off('selection:created', onSel);
      c.off('selection:updated', onSel);
      c.off('selection:cleared');
      try { c.dispose(); } catch {}
      fabricCanvasRef.current = null;
    };
  }, [visible]);

  // Ajusta el tamaño del lienzo a la maceta
  useEffect(() => {
    const c = fabricCanvasRef.current;
    if (!c) return;
    c.setWidth(baseSize.w);
    c.setHeight(baseSize.h);
    c.renderAll();
  }, [baseSize.w, baseSize.h]);

  // Modo edición: habilita canvas, deshabilita escena
  // === Interactividad Fabric según editing ===
useEffect(() => {
  const c =
    (typeof canvasRef !== 'undefined' && canvasRef?.current) ||
    (typeof fabricCanvasRef !== 'undefined' && fabricCanvasRef?.current) ||
    (typeof canvas !== 'undefined' && canvas) ||
    null;
  if (!c) return;

  const enableNode = (o, on) => {
    if (!o) return;
    o.selectable = on;
    o.evented = on;
    o.lockMovementX = !on;
    o.lockMovementY = !on;
    o.hasControls = on;
    o.hasBorders = on;
    if (o.type === 'i-text' || typeof o.enterEditing === 'function') o.editable = on;
    o.hoverCursor = on ? 'move' : 'default';

    const children = o._objects || (typeof o.getObjects === 'function' ? o.getObjects() : null);
    if (Array.isArray(children)) children.forEach(ch => enableNode(ch, on));
  };

  const setAll = (on) => {
    c.skipTargetFind = !on;
    c.selection = on;

    const objs = typeof c.getObjects === 'function' ? c.getObjects() : [];
    objs.forEach(o => enableNode(o, on));

    const upper = c.upperCanvasEl, lower = c.lowerCanvasEl;


 if (upper) { upper.style.pointerEvents = 'auto'; upper.style.touchAction = 'none'; upper.tabIndex = 0; }
 if (lower) { lower.style.pointerEvents = 'none'; lower.style.touchAction = 'none'; }

    else {
 if (upper) { upper.style.pointerEvents = 'none'; }
 if (upper) { upper.style.pointerEvents = 'none'; upper.style.touchAction = 'auto'; }
 if (lower) { lower.style.pointerEvents = 'none'; lower.style.touchAction = 'none'; }
}
    
    c.defaultCursor = on ? 'move' : 'default';
    c.discardActiveObject?.();
    c.calcOffset?.();
    c.requestRenderAll?.();
    setTimeout(() => { c.calcOffset?.(); c.requestRenderAll?.(); }, 0);
  };

  setAll(!!editing);
}, [editing]);


  // cuando cambie `editing`
useEffect(() => {
  window.dispatchEvent(new CustomEvent("dobo-editing", { detail: { editing } }));
}, [editing]);


// === Interactividad de Fabric mientras se diseña ===
// Zoom en modo Diseñar (móvil y PC). Sólido: sin pointer capture y con reset.
useEffect(() => {
  const c = fabricCanvasRef.current;
  const upper = c?.upperCanvasEl;
  if (!upper) return;

  const getZ = () => (
    typeof zoom === 'number'
      ? zoom
      : parseFloat(stageRef?.current?.style.getPropertyValue('--zoom')) || 1
  );

  const setZ = (z) => {
    const v = Math.max(0.8, Math.min(2.5, z));
    if (typeof setZoom === 'function') setZoom(v);
    else stageRef?.current?.style.setProperty('--zoom', String(v));
  };

  // rueda (PC)
  const onWheel = (e) => {
    if (!editing) return;
    e.preventDefault();
    setZ(getZ() + (e.deltaY > 0 ? -0.08 : 0.08));
  };

  // pinch (móvil) SIN pointer capture
  let p1 = null, p2 = null, startDist = 0, startScale = 1;

  const startIfReady = () => {
    if (p1 && p2 && !startDist) {
      startDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      startScale = getZ();
    }
  };

  const onPD = (e) => {
    if (!editing || e.pointerType !== 'touch') return;
    if (!p1) p1 = { id: e.pointerId, x: e.clientX, y: e.clientY };
    else if (!p2 && e.pointerId !== p1.id) p2 = { id: e.pointerId, x: e.clientX, y: e.clientY };
    startIfReady();
  };

  const onPM = (e) => {
    if (!editing || e.pointerType !== 'touch') return;
    if (p1 && e.pointerId === p1.id) { p1.x = e.clientX; p1.y = e.clientY; }
    else if (p2 && e.pointerId === p2.id) { p2.x = e.clientX; p2.y = e.clientY; }
    if (p1 && p2 && startDist) {
      e.preventDefault();
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      setZ(Math.max(0.8, Math.min(2.5, startScale * Math.pow(d / startDist, 0.9))));
    }
  };

  const reset = () => { p1 = null; p2 = null; startDist = 0; startScale = 1; };

  const optsNF = { passive: false };
  upper.addEventListener('wheel', onWheel, optsNF);
  upper.addEventListener('pointerdown', onPD, optsNF);
  upper.addEventListener('pointermove', onPM, optsNF);
  window.addEventListener('pointerup', reset, { passive: true });
  window.addEventListener('pointercancel', reset, { passive: true });
  window.addEventListener('touchend', reset, { passive: true });
  window.addEventListener('touchcancel', reset, { passive: true });

  return () => {
    upper.removeEventListener('wheel', onWheel);
    upper.removeEventListener('pointerdown', onPD);
    upper.removeEventListener('pointermove', onPM);
    window.removeEventListener('pointerup', reset);
    window.removeEventListener('pointercancel', reset);
    window.removeEventListener('touchend', reset);
    window.removeEventListener('touchcancel', reset);
  };
  // Importante: NO dependas de `zoom` ni `setZoom` para no recrear listeners en cada tick
}, [editing, stageRef]);





  // Bloquea clicks en maceta/carrusel, pero deja pasar dentro del overlay/canvas
  useEffect(() => {
    const hostA = anchorRef?.current;
    const hostS = stageRef?.current;
    const host = hostA || hostS;
    if (!host) return;

    const getAllowed = () => {
      const c = fabricCanvasRef.current;
      return [overlayRef.current, c?.upperCanvasEl].filter(Boolean);
    };
    const insideAllowed = (e) => {
      const allowed = getAllowed();
      const path = e.composedPath ? e.composedPath() : [];
      return path.some(n => allowed.includes(n));
    };

    const stop = (e) => {
      if (!editing) return;
      if (insideAllowed(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };

    const opts = { capture: true, passive: false };
    const evs = ['pointerdown','mousedown','touchstart','click','wheel'];
    evs.forEach(ev => host.addEventListener(ev, stop, opts));

    return () => { evs.forEach(ev => host.removeEventListener(ev, stop, opts)); };
  }, [editing, anchorRef, stageRef]);


  // ===== Utils de imagen =====
  const downscale = (imgEl) => {
    const w = imgEl.naturalWidth || imgEl.width;
    const h = imgEl.naturalHeight || imgEl.height;
    const r = Math.min(MAX_TEXTURE_DIM / w, MAX_TEXTURE_DIM / h, 1);
    if (!w || !h || r === 1) return imgEl;
    const cw = Math.round(w * r), ch = Math.round(h * r);
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imgEl, 0, 0, cw, ch);
    return cv;
  };

  // Otsu robusto
  const otsuThreshold = (gray, total) => {
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
  };

  // Vectoriza a bitmap BN con fondo transparente
  const vectorizeElementToBitmap = (
    element,
    opts = {}
  ) => {
    const {
      maxDim   = VECTOR_SAMPLE_DIM,
      makeDark = true,
      drawColor = [51, 51, 51],
      thrBias  = 0
    } = opts;

    const iw = element?.width, ih = element?.height;
    if (!iw || !ih) return null;

    // 1) Escalado de muestreo
    const scale = (iw > ih) ? maxDim / iw : maxDim / ih;
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));

    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(element, 0, 0, w, h);

    // 2) Umbral binario con fondo transparente (Otsu + sesgo)
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
    const thr  = clamp(thr0 + thrBias, 0, 255);

    for (let j = 0, i = 0; j < total; j++, i += 4) {
      const keep = makeDark ? (gray[j] <= thr) : (gray[j] > thr);
      if (keep) {
        data[i]   = drawColor[0];
        data[i+1] = drawColor[1];
        data[i+2] = drawColor[2];
        data[i+3] = 255;
      } else {
        data[i+3] = 0; // transparente
      }
    }
    ctx.putImageData(img, 0, 0);

    const bm = new fabric.Image(cv, {
      left: 0, top: 0,
      originX: 'left', originY: 'top',
      objectCaching: false,
      noScaleCache: true,
      selectable: true,
      evented: true,
    });
    bm._vecSourceEl = element;
    bm._vecMeta = { w, h };
    return bm;
  };

  // ===== Relieve Imagen =====
  const attachDebossToBase = (c, baseObj, { offset = 1 } = {}) => {
    const cloneFrom = () => {
      const el = typeof baseObj.getElement === 'function' ? baseObj.getElement() : baseObj._element;
      return new fabric.Image(el, {
        originX: baseObj.originX, originY: baseObj.originY,
        left: baseObj.left, top: baseObj.top,
        scaleX: baseObj.scaleX, scaleY: baseObj.scaleY,
        angle: baseObj.angle || 0,
        selectable: false, evented: false,
        objectCaching: false, noScaleCache: true,
      });
    };
    baseObj.set({ objectCaching: false, noScaleCache: true });
    const shadow = cloneFrom(), highlight = cloneFrom();
    if (!shadow || !highlight) return;
    c.add(baseObj); c.add(shadow); c.add(highlight);
    shadow.set({ globalCompositeOperation: 'multiply', opacity: 1.0 });
    highlight.set({ globalCompositeOperation: 'screen',   opacity: 1.0 });
    const sync = () => {
      const props = ['left','top','scaleX','scaleY','angle','originX','originY'];
      [shadow, highlight].forEach((g,i) => {
        props.forEach(p => g.set(p, baseObj[p]));
        const d = i === 0 ? -offset : +offset;
        g.set({ left: baseObj.left + d, top: baseObj.top + d });
        g.setCoords();
      });
      c.requestRenderAll();
    };
    baseObj._deboss = { shadow, highlight };
    baseObj._debossParams = { offset };
    baseObj._debossSync = sync;
    ['modified','moving','scaling','rotating','skewing'].forEach(ev => baseObj.on(ev, sync));
    sync();
  };

  const updateDebossVisual = (baseObj, { offset }) => {
    if (!baseObj || !baseObj._deboss) return;
    baseObj._debossParams = { ...(baseObj._debossParams||{}), offset };
    if (baseObj._debossSync) baseObj._debossSync();
  };

  const clearDeboss = (obj) => {
    const c = fabricCanvasRef.current || obj?.canvas; if (!c || !obj || !obj._deboss) return;
    const { shadow, highlight } = obj._deboss;
    try { c.remove(shadow); } catch {}
    try { c.remove(highlight); } catch {}
    if (obj._debossSync) ['modified','moving','scaling','rotating','skewing'].forEach(ev => { try { obj.off(ev, obj._debossSync); } catch {} });
    delete obj._deboss; delete obj._debossSync; delete obj._debossParams;
  };

  // ===== Relieve Texto =====
  const applyDebossToText = (t) => {
    const c = fabricCanvasRef.current; if (!c || !t) return;
    const ownerId = `txt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    t._debossOwnerId = ownerId; t.__ownerId = ownerId;
    t.set({ fill: '#2525257b', shadow: null, stroke: null, globalCompositeOperation: 'multiply', objectCaching: false });
    const baseOpts = {
      fontFamily: t.fontFamily, fontSize: t.fontSize, fontWeight: t.fontWeight,
      fontStyle: t.fontStyle, underline: t.underline, textAlign: t.textAlign,
      charSpacing: t.charSpacing, originX: t.originX, originY: t.originY, angle: t.angle, width: t.width,
      selectable: false, evented: false, opacity: 0.9, objectCaching: false,
    };
    const makeClone = (dx, dy, stroke, strokeWidth, gco) => {
      const clone = new t.constructor(t.text, { ...baseOpts, left: t.left + dx, top: t.top + dy, fill: '', stroke, strokeWidth, globalCompositeOperation: gco });
      clone.__isDebossClone = true; clone.__ownerId = ownerId; clone.__cloneOf = t; clone.excludeFromExport = true;
      return clone;
    };
    const shadow = makeClone(-1, -1, 'rgba(0,0,0,0.48)', 1, 'multiply');
    const highlight = makeClone( 1,  1, 'rgba(255,255,255,0.65)', 0.6, 'screen');
    t.__debossClones = [shadow, highlight];
    c.add(t); c.add(shadow); c.add(highlight); c.setActiveObject(t);
    const sync = () => {
      const props = ['left','top','scaleX','scaleY','angle','width','fontSize','fontFamily','fontWeight','fontStyle','charSpacing','textAlign','underline','text','originX','originY'];
      [shadow, highlight].forEach(o => { props.forEach(p => o.set(p, t[p])); });
      shadow.set({ left: t.left - 1, top: t.top - 1 });
      highlight.set({ left: t.left + 1, top: t.top + 1 });
      c.requestRenderAll();
    };
    t._debossers = { shadow, highlight }; t._debossSync = sync;
    t.on('changed',  sync);
    t.on('modified', sync);
    t.on('moving',   sync);
    t.on('scaling',  sync);
    t.on('rotating', sync);
    t.on('resizing', sync);
    sync();
  };

  // ===== Acciones =====
  const addText = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    const t = new fabric.Textbox('Nuevo párrafo', {
      left: baseSize.w / 2, top: baseSize.h / 2, originX: 'center', originY: 'center',
      width: Math.min(baseSize.w * 0.9, 220),
      fontSize, fontFamily, fontWeight: isBold ? '700' : 'normal', fontStyle: isItalic ? 'italic' : 'normal',
      underline: isUnderline, textAlign, fill: 'rgba(35,35,35,1)', selectable: true, editable: true, objectCaching: false,
    });
    c.add(t); applyDebossToText(t); c.requestRenderAll(); setEditing(true);
  };

  const addImageFromFile = (file) => {
    const c = fabricCanvasRef.current; if (!c || !file) return;
    const url = URL.createObjectURL(file);
    const imgEl = new Image(); imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => {
      const src = downscale(imgEl);
      const baseImg = vectorizeElementToBitmap(src, { maxDim: VECTOR_SAMPLE_DIM, makeDark: !vecInvert, drawColor: [51,51,51], thrBias: vecBias });
      if (!baseImg) { URL.revokeObjectURL(url); return; }
      const maxW = c.getWidth() * 0.8, maxH = c.getHeight() * 0.8;
      const s = Math.min(maxW / baseImg._vecMeta.w, maxH / baseImg._vecMeta.h);
      baseImg.set({ originX: 'center', originY: 'center', left: c.getWidth()/2, top: c.getHeight()/2, scaleX: s, scaleY: s, selectable: true, evented: true, objectCaching: false });
      attachDebossToBase(c, baseImg, { offset: vecOffset });
      c.setActiveObject(baseImg);
      setSelType('image');
      c.requestRenderAll();
      setEditing(true);
      URL.revokeObjectURL(url);
    };
    imgEl.onerror = () => URL.revokeObjectURL(url);
    imgEl.src = url;
  };

  const replaceActiveFromFile = (file) => {
    const c = fabricCanvasRef.current; if (!c || !file) return;
    const active = c.getActiveObject(); if (!active) return;
    const url = URL.createObjectURL(file);
    const imgEl = new Image(); imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => {
      const src = downscale(imgEl);
      const pose = { left: active.left, top: active.top, originX: active.originX, originY: active.originY, scaleX: active.scaleX, scaleY: active.scaleY, angle: active.angle || 0 };
      if (active._deboss) clearDeboss(active);
      try { c.remove(active); } catch {}
      const baseImg = vectorizeElementToBitmap(src, { maxDim: VECTOR_SAMPLE_DIM, makeDark: !vecInvert, drawColor: [51,51,51], thrBias: vecBias });
      if (!baseImg) { URL.revokeObjectURL(url); return; }
      baseImg.set({ ...pose, selectable: true, evented: true, objectCaching: false });
      attachDebossToBase(c, baseImg, { offset: vecOffset });
      c.setActiveObject(baseImg);
      setSelType('image');
      c.requestRenderAll();
      setEditing(true);
      URL.revokeObjectURL(url);
    };
    imgEl.onerror = () => URL.revokeObjectURL(url);
    imgEl.src = url;
  };

  // ===== Borrado robusto =====
  const detachDebossEvents = (o) => {
    try {
      if (o && o._debossSync) {
        ['changed','modified','moving','scaling','rotating','resizing'].forEach(ev => o.off(ev, o._debossSync));
      }
    } catch {}
  };

  const looksLikeDebossClone = (o, base) => {
    if (!o) return false;
    if (o.__isDebossClone) return true;
    const isText = (o.type === 'i-text' || o.type === 'textbox' || o.type === 'text');
    if (!isText) return false;
    const s = (o.stroke || '').toString();
    const reliefStroke = s.includes('rgba(0,0,0,0.48)') || s.includes('rgba(255,255,255,0.65)');
    const near = Math.abs(o.left - base.left) <= 2 && Math.abs(o.top - base.top) <= 2;
    return reliefStroke && near && o.text === base.text;
  };

  const collectTextFamily = (c, base) => {
    const set = new Set();
    const all = c.getObjects();
    const fam = base._debossOwnerId || base.__ownerId;
    set.add(base);
    if (base._debossers) {
      const { shadow, highlight } = base._debossers;
      if (shadow) set.add(shadow);
      if (highlight) set.add(highlight);
    }
    if (fam) {
      all.forEach(o => {
        if (o && (o._debossOwnerId === fam || o.__ownerId === fam)) set.add(o);
      });
    }
    all.forEach(o => { if (o !== base && looksLikeDebossClone(o, base)) set.add(o); });
    return set;
  };

  const sweepDebossGhosts = (c) => {
    const leftovers = c.getObjects().filter(o =>
      o?.__isDebossClone ||
      ((o?.type === 'i-text' || o?.type === 'textbox' || o?.type === 'text') &&
       (o.globalCompositeOperation === 'multiply' || o.globalCompositeOperation === 'screen'))
    );
    leftovers.forEach(o => { try { c.remove(o); } catch {} });
  };

  const removeWithDeboss = (c, obj) => {
    if (!obj) return;
    if (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') {
      const fam = collectTextFamily(c, obj);
      fam.forEach(detachDebossEvents);
      fam.forEach(o => { try { c.remove(o); } catch {} });
    } else {
      if (obj._deboss) clearDeboss(obj);
      try { c.remove(obj); } catch {}
    }
  };

  const onDelete = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;

    if (a.type === 'activeSelection' && a._objects?.length) {
      const arr = a._objects.slice();
      a.discard();
      arr.forEach(o => removeWithDeboss(c, o));
    } else {
      removeWithDeboss(c, a);
    }

    sweepDebossGhosts(c);
    c.discardActiveObject();
    c.requestRenderAll();
    setSelType('none');
  };

const clearSelectionHard = () => {
  const c = fabricCanvasRef.current; if (!c) return;
  try {
    c.getObjects().forEach(o => { if (o?.isEditing && typeof o.exitEditing === 'function') o.exitEditing(); });
  } catch {}
  try { const a = c.getActiveObject(); if (a?.type === 'activeSelection') a.discard(); } catch {}
  try { c.discardActiveObject(); } catch {}
  try { c.setActiveObject(null); } catch {}
  try { c._activeObject = null; } catch {}
  setSelType('none');
  c.requestRenderAll();
};

const enterDesignMode = () => {
  suppressSelectionRef.current = true;
  clearSelectionHard();
  setEditing(true);
  // limpiar de nuevo en el siguiente frame y soltar la supresión
  requestAnimationFrame(() => {
    clearSelectionHard();
    setTimeout(() => { suppressSelectionRef.current = false; }, 150);
  });
};

const exitDesignMode = () => {
  suppressSelectionRef.current = true;
  clearSelectionHard();
  setEditing(false);
  setTimeout(() => { suppressSelectionRef.current = false; }, 150);
};



  // ===== Aplicar a selección (Texto) =====
  const applyToSelection = (mutator) => {
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;
    const isText = (o) => o && (o.type === 'i-text' || o.type === 'textbox' || o.type === 'text');
    const apply = (obj) => { if (isText(obj)) { mutator(obj); obj._debossSync && obj._debossSync(); obj.setCoords(); } };
    if (a.type === 'activeSelection' && Array.isArray(a._objects)) a._objects.forEach(apply); else apply(a);
    c.requestRenderAll();
  };

  // ===== Re-vectorización automática por Detalles/Invertir =====
  useEffect(() => {
    if (!editing || selType !== 'image') return;
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;

    const rebuild = (obj) => {
      let element = null;
      const pose = { left: obj.left, top: obj.top, originX: obj.originX, originY: obj.originY, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle || 0 };
      if (obj._vecSourceEl) { element = obj._vecSourceEl; clearDeboss(obj); try { c.remove(obj); } catch {} }
      else if (obj.type === 'image') { element = (typeof obj.getElement === 'function' ? obj.getElement() : (obj._originalElement || obj._element)); try { c.remove(obj); } catch {} }
      else { return; }

      const baseImg = vectorizeElementToBitmap(element, { maxDim: VECTOR_SAMPLE_DIM, makeDark: !vecInvert, drawColor: [51,51,51], thrBias: vecBias });
      if (!baseImg) return;
      baseImg.set({ ...pose, selectable: true, evented: true, objectCaching: false });
      attachDebossToBase(c, baseImg, { offset: vecOffset });
      c.setActiveObject(baseImg);
    };

    if (a.type === 'activeSelection' && a._objects?.length) {
      const arr = a._objects.slice(); a.discard(); arr.forEach(rebuild);
    } else { rebuild(a); }

    c.requestRenderAll();
  }, [vecBias, vecInvert]); // mantiene selección tras re-vectorizar

  // ===== Offset del relieve en caliente =====
  useEffect(() => {
    if (!editing || selType !== 'image') return;
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;
    const upd = (obj) => { if (obj._deboss) updateDebossVisual(obj, { offset: vecOffset }); };
    if (a.type === 'activeSelection' && a._objects?.length) a._objects.forEach(upd); else upd(a);
  }, [vecOffset, editing, selType]);

  if (!visible) return null;

  // ===== Overlay Canvas (dentro de la maceta; escala junto con la escena) =====
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
   overscrollBehavior: "contain",
  }}
>

      <canvas
        data-dobo-design="1" 
        ref={canvasRef}
        width={overlayBox.w}
        height={overlayBox.h}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          background: 'transparent',
          touchAction: editing ? 'none' : 'auto'
        }}
      />
    </div>
  );

  // ===== Menú fijo (abajo, se despliega hacia arriba, ancho al contenido) =====
  function Menu() {
    return (
      <div
        ref={menuRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: 'rgba(253, 253, 253, 0.34)',
          backdropFilter: 'blur(4px)',        // opcional
          WebkitBackdropFilter: 'blur(4px)',  // opcional Safari
          border: '1px solid #ddd',
          borderRadius: 12,
          padding: '10px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          width: 'auto',
          maxWidth: '94vw',
          fontSize: 12,
          userSelect: 'none'
        }}
      >
        {/* LÍNEA 1: Zoom + modos */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {typeof setZoom === 'function' && (
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
  className={`btn ${!editing ? 'btn-dark' : 'btn-outline-secondary'} text-nowrap`}
  onMouseDown={(e)=>e.preventDefault()}
  onClick={exitDesignMode}
  style={{ minWidth: '16ch' }}
>
  Seleccionar Maceta
</button>

<button
  type="button"
  className={`btn ${editing ? 'btn-dark' : 'btn-outline-secondary'} text-nowrap`}
  onMouseDown={(e)=>e.preventDefault()}
  onClick={enterDesignMode}
  style={{ minWidth: '12ch' }}
>
  Diseñar
</button>

        </div>

        {/* LÍNEA 2: Acciones básicas */}
        {editing && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addText} disabled={!ready}>
              + Texto
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => addInputRef.current?.click()}
              disabled={!ready}
            >
              + Imagen
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={onDelete}
              disabled={!ready || selType === 'none'}
              title="Eliminar seleccionado"
            >
              Borrar
            </button>
          </div>
        )}

        {/* LÍNEA 3: Propiedades por tipo */}
        {editing && (
          <>
            {selType === 'text' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <div className="input-group input-group-sm" style={{ maxWidth: 220 }}>
                  <span className="input-group-text">Fuente</span>
                  <select
                    className="form-select form-select-sm"
                    value={fontFamily}
                    onChange={(e) => { const v = e.target.value; setFontFamily(v); applyToSelection(o => o.set({ fontFamily: v })); }}
                  >
                    {FONT_OPTIONS.map(f => (
                      <option key={f.name} value={f.css} style={{ fontFamily: f.css }}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div className="btn-group btn-group-sm" role="group" aria-label="Estilos">
                  <button
                    type="button"
                    className={`btn ${isBold ? 'btn-dark' : 'btn-outline-secondary'}`}
                    onClick={() => { const nv = !isBold; setIsBold(nv); applyToSelection(o => o.set({ fontWeight: nv ? '700' : 'normal' })); }}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    className={`btn ${isItalic ? 'btn-dark' : 'btn-outline-secondary'}`}
                    onClick={() => { const nv = !isItalic; setIsItalic(nv); applyToSelection(o => o.set({ fontStyle: nv ? 'italic' : 'normal' })); }}
                  >
                    I
                  </button>
                  <button
                    type="button"
                    className={`btn ${isUnderline ? 'btn-dark' : 'btn-outline-secondary'}`}
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
                    onChange={(e) => {
                      const v = clamp(parseInt(e.target.value || '0', 10), 8, 200);
                      setFontSize(v); applyToSelection(o => o.set({ fontSize: v }));
                    }}
                  />
                </div>

                <div className="btn-group dropup">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowAlignMenu(v => !v)}>
                    {textAlign === 'left' ? '⟸' : textAlign === 'center' ? '⟺' : textAlign === 'right' ? '⟹' : '≣'}
                  </button>
                  {showAlignMenu && (
                    <ul className="dropdown-menu show" style={{ position: 'absolute' }}>
                      {['left','center','right','justify'].map(a => (
                        <li key={a}>
                          <button
                            type="button"
                            className={`dropdown-item ${textAlign === a ? 'active' : ''}`}
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
            )}

            {selType === 'image' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <div className="input-group input-group-sm" style={{ width: 230 }}>
                  <span className="input-group-text">Detalles</span>
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setVecBias(v => clamp(v - 5, -60, 60))}>−</button>
                  <input type="text" readOnly className="form-control form-control-sm text-center" value={vecBias} />
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setVecBias(v => clamp(v + 5, -60, 60))}>+</button>
                </div>

                <div className="input-group input-group-sm" style={{ width: 190 }}>
                  <span className="input-group-text">Profundidad</span>
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setVecOffset(v => clamp(v - 1, 0, 5))}>−</button>
                  <input type="text" readOnly className="form-control form-control-sm text-center" value={vecOffset} />
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setVecOffset(v => clamp(v + 1, 0, 5))}>+</button>
                </div>

                <div className="btn-group btn-group-sm" role="group" aria-label="Invertir">
                  <button type="button" className={`btn ${!vecInvert ? 'btn-dark' : 'btn-outline-secondary'}`} onClick={() => setVecInvert(false)}>Oscuro</button>
                  <button type="button" className={`btn ${vecInvert ? 'btn-dark' : 'btn-outline-secondary'}`} onClick={() => setVecInvert(true)}>Claro</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Inputs ocultos */}
        <input ref={addInputRef} type="file" accept="image/*"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) addImageFromFile(f); e.target.value=''; }}
          style={{ display: 'none' }} />
        <input ref={replaceInputRef} type="file" accept="image/*"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceActiveFromFile(f); e.target.value=''; }}
          style={{ display: 'none' }} />
      </div>
    );
  }

  // ===== Render =====
  return (
    <>
      {/* Overlay dentro de la maceta: escala junto con maceta, texto e imagen */}
      {stageRef?.current ? createPortal(OverlayCanvas, stageRef.current) : null}


      {/* Menú fijo abajo de la página. Se despliega hacia arriba. Ancho según contenido */}
      {typeof document !== 'undefined' ? createPortal(
        <div
          style={{
            position: 'fixed',
            left: anchorRect ? (anchorRect.left + anchorRect.width / 2) : '50%',
            bottom: 8,
            transform: 'translateX(-50%)',
            zIndex: Z_MENU,
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}
        >
          <div style={{ pointerEvents: 'auto', display: 'inline-flex' }}>
            <Menu />
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
