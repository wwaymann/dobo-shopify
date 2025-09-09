// components/CustomizationOverlay.js
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { createPortal } from 'react-dom';
import HistoryManager from '../lib/history';
import { saveSessionDesign, loadSessionDesign } from '../lib/designStore';

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
  productHandle, // clave por producto para autosave de sesión
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
  const [textEditing, setTextEditing] = useState(false);

  // Forzar repintado tras aplicar snapshots
  const isApplyingRef = useRef(false);
  function forceRepaint() {
    const c = fabricCanvasRef.current; if (!c) return;
    try { (c.getObjects() || []).forEach(o => o.dirty = true); c.discardActiveObject(); } catch {}
    c.calcOffset?.(); c.renderAll?.(); c.requestRenderAll?.();
    setTimeout(() => { c.calcOffset?.(); c.requestRenderAll?.(); }, 0);
  }

  // Historial con autosave a sesión por producto
  const historyRef = useRef(new HistoryManager({
    limit: 200,
    onChange: (current) => {
      if (!current) return;
      if (isApplyingRef.current) return; // no guardes mientras aplicas undo/redo
      saveSessionDesign(productHandle, current);
    }
  }));

  useEffect(() => {
    const c = fabricCanvasRef.current;
    const upper = c?.upperCanvasEl;
    if (!upper) return;
    upper.style.touchAction = textEditing ? 'auto' : (editing ? 'none' : 'auto');
  }, [textEditing, editing]);

  // Mantén --zoom siempre actualizado para leerlo en tiempo real
  useEffect(() => {
    const v = typeof zoom === 'number' ? zoom : 1;
    stageRef?.current?.style.setProperty('--zoom', String(v));
  }, [zoom, stageRef]);

  // ===== Layout y medidas =====
  useLayoutEffect(() => {
    const el = anchorRef?.current;
    if (!el) return;
    const prev = el.style.position;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    return () => { try { el.style.position = prev; } catch {} };
  }, [anchorRef]);

  // Medida exacta del área de la maceta en coords locales del stage
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
    window.addEventListener('resize', measure, { passive: true });

    return () => {
      try { roA.disconnect(); } catch {}
      try { roS.disconnect(); } catch {}
      window.removeEventListener('resize', measure);
    };
  }, [stageRef, anchorRef]);

  // Posiciona el menú dentro de la columna de carruseles
  useLayoutEffect(() => {
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

  // ===== Helpers de relieve =====
  const makeTextGroup = (text, opts = {}) => {
    const base = new fabric.Textbox(text, {
      ...opts,
      originX: 'center', originY: 'center',
      selectable: false, evented: false,
      objectCaching: false, shadow: null, stroke: null,
      fill: 'rgba(35,35,35,1)', globalCompositeOperation: 'multiply'
    });
    const shadow = new fabric.Textbox(text, {
      ...opts,
      originX: 'center', originY: 'center',
      left: -1, top: -1,
      selectable: false, evented: false,
      objectCaching: false, fill: '',
      stroke: 'rgba(0,0,0,0.48)', strokeWidth: 1,
      globalCompositeOperation: 'multiply'
    });
    const highlight = new fabric.Textbox(text, {
      ...opts,
      originX: 'center', originY: 'center',
      left: +1, top: +1,
      selectable: false, evented: false,
      objectCaching: false, fill: '',
      stroke: 'rgba(255,255,255,0.65)', strokeWidth: 0.6,
      globalCompositeOperation: 'screen'
    });

    const group = new fabric.Group([shadow, highlight, base], {
      originX: 'center', originY: 'center',
      subTargetCheck: false,
      objectCaching: false,
      selectable: true, evented: true,
      scaleX: 1, scaleY: 1
    });
    group._kind = 'textGroup';
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
    group.on('scaling',  sync);
    group.on('modified', sync);
    sync();
    return group;
  };

  const attachDebossToBase = (c, baseObj, { offset = 1 } = {}) => {
    const cloneFrom = () => {
      const el = typeof baseObj.getElement === 'function' ? baseObj.getElement() : baseObj._element;
      return new fabric.Image(el, {
        originX: 'center', originY: 'center',
        objectCaching: false, noScaleCache: true, selectable: false, evented: false,
      });
    };

    const base = cloneFrom();
    const shadow = cloneFrom();
    const highlight = cloneFrom();

    const group = new fabric.Group([shadow, highlight, base], {
      originX: 'center', originY: 'center',
      objectCaching: false, selectable: true, evented: true,
      subTargetCheck: false,
    });
    group._kind = 'imgGroup';
    group._imgChildren = { base, shadow, highlight };
    group._debossOffset = offset;

    // pose inicial desde baseObj
    group.left    = baseObj.left ?? 0;
    group.top     = baseObj.top ?? 0;
    group.scaleX  = baseObj.scaleX ?? 1;
    group.scaleY  = baseObj.scaleY ?? 1;
    group.angle   = baseObj.angle  ?? 0;

    const srcEl = typeof baseObj.getElement === 'function' ? baseObj.getElement() : baseObj._element;
    const applyElement = (img) => {
      base.setElement(img); shadow.setElement(img); highlight.setElement(img);
    };
    applyElement(srcEl);

    shadow.set({ globalCompositeOperation: 'multiply', opacity: 1 });
    highlight.set({ globalCompositeOperation: 'screen', opacity: 1 });

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

    group.on('scaling', normalizeImgOffsets);
    group.on('modified', normalizeImgOffsets);
    normalizeImgOffsets();

    return group;
  };

  const updateDebossVisual = (obj, { offset }) => {
    const g = obj && obj._kind === 'imgGroup' ? obj : null;
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
  };

  // ===== Utils imagen/vectorizado =====
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

  const vectorizeElementToBitmap = (element, opts = {}) => {
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

    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
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

// ===== Utils imagen/vectorizado =====
  // Rearma selectabilidad y punteros tras cargar snapshot
 // Rearma selectabilidad y punteros tras cargar snapshot (según 'on')
  const rearmInteractivity = (on) => {
    const c = fabricCanvasRef.current; if (!c) return;

   const enableNode = (o) => {
       if (!o) return;
       const isGroup = o._kind === 'imgGroup' || o._kind === 'textGroup';
       o.selectable   = on;
       o.evented      = on;
       o.lockMovementX = !on;
       o.lockMovementY = !on;
       o.hasControls  = on;
       o.hasBorders   = on;
       if (!isGroup && (o.type === 'i-text' || typeof o.enterEditing === 'function')) o.editable = on;
       o.hoverCursor  = on ? 'move' : 'default';
       const children = o._objects || (typeof o.getObjects === 'function' ? o.getObjects() : null);
       if (Array.isArray(children)) children.forEach(enableNode);
     };
     c.skipTargetFind = !on;
     c.selection = on;
     (c.getObjects?.() || []).forEach(enableNode);
     const upper = c.upperCanvasEl, lower = c.lowerCanvasEl;
     if (upper) { upper.style.pointerEvents = on ? 'auto' : 'none'; upper.style.touchAction = on ? 'none' : 'auto'; upper.tabIndex = on ? 0 : -1; }
     if (lower) { lower.style.pointerEvents = 'none'; lower.style.touchAction = 'none'; }
     c.defaultCursor = on ? 'move' : 'default';
     try { c.discardActiveObject(); } catch {}
     c.calcOffset?.(); c.requestRenderAll?.();
     setTimeout(() => { c.calcOffset?.(); c.requestRenderAll?.(); }, 0);
   };
  
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
    c.renderOnAddRemove = true;

    // API mínima
    if (typeof window !== 'undefined') {
      window.doboDesignAPI = {
        toPNG: (mult = 3) => c.toDataURL({ format: 'png', multiplier: mult, backgroundColor: 'transparent' }),
        toSVG: () => c.toSVG({ suppressPreamble: true }),
        getCanvas: () => c,
      };
    }

    // Helpers de tipo
    const classify = (a) => {
      if (!a) return 'none';
      if (a._kind === 'imgGroup')  return 'image';
      if (a._kind === 'textGroup') return 'text';
      if (a.type === 'activeSelection' && a._objects?.length) {
        if (a._objects.every(o => o._kind === 'textGroup')) return 'text';
        if (a._objects.some(o => o._kind === 'imgGroup'))    return 'image';
        return 'none';
      }
      if (a.type === 'image') return 'image';
      if (a.type === 'i-text' || a.type === 'textbox' || a.type === 'text') return 'text';
      return 'none';
    };

    const isTextObj = (o) => o && (o.type === 'i-text' || o.type === 'textbox' || o.type === 'text');

    const reflectTypo = () => {
      const a = c.getActiveObject();
      if (!a) return;
      let first = null;
      if (a._kind === 'textGroup') first = a._textChildren?.base || null;
      else if (a.type === 'activeSelection') first = a._objects?.find(x => x._kind === 'textGroup')?._textChildren?.base || null;
      else if (isTextObj(a)) first = a;
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

    // Snapshot al modificar objetos (mover, escalar, rotar, etc.)
    c.on('object:modified', () => {
      const snap = exportDesignSnapshot();
      if (snap) historyRef.current.push(snap);
    });

    // Doble-click (desktop) → editar texto del grupo
    c.on('mouse:dblclick', (e) => {
      const t = e.target;
      if (!t) return;
      if (t._kind === 'textGroup') startInlineTextEdit(t);
      else if (isTextObj(t) && typeof t.enterEditing === 'function') {
        t.enterEditing();
        c.requestRenderAll();
      }
    });

    setReady(true);

    return () => {
      c.off('mouse:dblclick');
      c.off('selection:created', onSel);
      c.off('selection:updated', onSel);
      c.off('selection:cleared');
      c.off('object:modified');
      try { c.dispose(); } catch {}
      fabricCanvasRef.current = null;
    };
  }, [visible]);

  // Semilla de sesión/servidor una vez listo
  useEffect(() => {
    if (!ready || !productHandle) return;
    const seed = loadSessionDesign(productHandle);
    if (seed) {
      applyDesignSnapshotToCanvas(seed);
      if (historyRef.current.replaceAll) historyRef.current.replaceAll([seed]);
      else { historyRef.current.clear?.(); historyRef.current.push(seed); }
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/design/load?handle=${encodeURIComponent(productHandle)}`);
        if (r.ok) {
          const data = await r.json(); // { snapshot }
          if (data?.snapshot) {
            applyDesignSnapshotToCanvas(data.snapshot);
            if (historyRef.current.replaceAll) historyRef.current.replaceAll([data.snapshot]);
            else { historyRef.current.clear?.(); historyRef.current.push(data.snapshot); }
          }
        }
      } catch {}
    })();
  }, [ready, productHandle]);

  // Ajusta tamaño de lienzo
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
      const isGroup = o._kind === 'imgGroup' || o._kind === 'textGroup';
      o.selectable   = on;
      o.evented      = on;
      o.lockMovementX = !on;
      o.lockMovementY = !on;
      o.hasControls  = on;
      o.hasBorders   = on;
      if (!isGroup && (o.type === 'i-text' || typeof o.enterEditing === 'function')) o.editable = on;
      o.hoverCursor  = on ? 'move' : 'default';
      if (isGroup) return;
      const children = Array.isArray(o._objects)
   ? o._objects
   : (typeof o.getObjects === 'function' ? o.getObjects() : null);
      if (Array.isArray(children)) children.forEach(ch => enableNode(ch, on));
    };

    const setAll = (on) => {
      c.skipTargetFind = !on;
      c.selection = on;
      (c.getObjects?.() || []).forEach(o => enableNode(o, on));
      const upper = c.upperCanvasEl;
      const lower = c.lowerCanvasEl;
      if (upper) { upper.style.pointerEvents = on ? 'auto' : 'none'; upper.style.touchAction = on ? 'none' : 'auto'; upper.tabIndex = on ? 0 : -1; }
      if (lower) { lower.style.pointerEvents = 'none'; lower.style.touchAction = 'none'; }
      c.defaultCursor = on ? 'move' : 'default';
      try { c.discardActiveObject(); } catch {}
      c.calcOffset?.();
      c.requestRenderAll?.();
      setTimeout(() => { c.calcOffset?.(); c.requestRenderAll?.(); }, 0);
    };

    setAll(!!editing);
  }, [editing]);

  // Heredar flags al añadir objetos
  useEffect(() => {
    const c = fabricCanvasRef.current; if (!c) return;
    const apply = (o) => {
      o.selectable = editing;
      o.evented = editing;
      o.lockMovementX = !editing;
      o.lockMovementY = !editing;
      if (o.type === 'i-text' || typeof o.enterEditing === 'function') o.editable = editing;
      o.hoverCursor = editing ? 'move' : 'default';
    };
    const onAdded = (e) => { if (e?.target) apply(e.target); };
    c.on('object:added', onAdded);
    return () => { c.off('object:added', onAdded); };
  }, [editing]);

  // Anunciar cambio de modo
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('dobo-editing', { detail: { editing } }));
  }, [editing]);

  // === Edición inline de texto (móvil/desktop) ===
  const startInlineTextEdit = (group) => {
    const c = fabricCanvasRef.current; if (!c || !group || group._kind !== 'textGroup') return;
    const base = group._textChildren?.base; if (!base) return;

    const pose = {
      left: group.left, top: group.top, originX: 'center', originY: 'center',
      scaleX: group.scaleX || 1, scaleY: group.scaleY || 1, angle: group.angle || 0
    };

    try { c.remove(group); } catch {}

    const tb = new fabric.Textbox(base.text || 'Texto', {
      left: pose.left, top: pose.top, originX: 'center', originY: 'center',
      width: Math.min(baseSize.w * 0.9, base.width || 220),
      fontFamily: base.fontFamily, fontSize: base.fontSize, fontWeight: base.fontWeight,
      fontStyle: base.fontStyle, underline: base.underline, textAlign: base.textAlign,
      editable: true, selectable: true, evented: true, objectCaching: false
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
      const newText = tb.text || '';
      const finalPose = {
        left: tb.left, top: tb.top, originX: tb.originX, originY: tb.originY,
        scaleX: tb.scaleX, scaleY: tb.scaleY, angle: tb.angle
      };
      try { c.remove(tb); } catch {}

      const group2 = makeTextGroup(newText, {
        width: tb.width,
        fontFamily: tb.fontFamily, fontSize: tb.fontSize, fontWeight: tb.fontWeight,
        fontStyle: tb.fontStyle, underline: tb.underline, textAlign: tb.textAlign,
      });
      group2.set(finalPose);
      c.add(group2);
      c.setActiveObject(group2);
      c.requestRenderAll();
      setSelType('text');

      setTextEditing(false);

      const snap = exportDesignSnapshot();
      if (snap) historyRef.current.push(snap);
    };

    const onExit = () => { tb.off('editing:exited', onExit); finish(); };
    tb.on('editing:exited', onExit);

    const safety = setTimeout(() => {
      try { tb.off('editing:exited', onExit); } catch {}
      finish();
    }, 15000);
    tb.on('removed', () => { clearTimeout(safety); });
  };

  // Doble-tap móvil: detectar y abrir edición de texto
  useEffect(() => {
    const c = fabricCanvasRef.current;
    const upper = c?.upperCanvasEl;
    if (!upper) return;

    let lastTap = 0;
    const onTap = (e) => {
      if (!editing || e.pointerType !== 'touch') return;
      const now = Date.now();
      if (now - lastTap < 320) {
        try {
          const target = c.findTarget?.(e, false);
          if (target && target._kind === 'textGroup') {
            e.preventDefault(); e.stopPropagation();
            startInlineTextEdit(target);
          }
        } catch {}
      }
      lastTap = now;
    };

    upper.addEventListener('pointerup', onTap, { passive: false, capture: true });
    return () => { upper.removeEventListener('pointerup', onTap, { capture: true }); };
  }, [editing]);

  // Zoom global PC y móvil
  useEffect(() => {
    const c = fabricCanvasRef.current;
    const target = stageRef?.current || c?.upperCanvasEl;
    if (!target) return;

    const readZ = () => {
      const el = stageRef?.current;
      const v = el?.style.getPropertyValue('--zoom') || (el ? getComputedStyle(el).getPropertyValue('--zoom') : '1');
      const n = parseFloat((v || '1').trim());
      return Number.isFinite(n) && n > 0 ? n : 1;
    };
    const writeZ = (z) => {
      const v = Math.max(0.8, Math.min(2.5, z));
      stageRef?.current?.style.setProperty('--zoom', String(v));
      if (typeof setZoom === 'function') setZoom(v);
    };

    const onWheel = (e) => {
      if (textEditing) return;
      e.preventDefault();
      writeZ(readZ() + (e.deltaY > 0 ? -0.08 : 0.08));
    };

    let pA = null, pB = null, startDist = 0, startScale = 1, parked = false, saved = null;
    const park = () => {
      if (parked || !c) return;
      saved = { selection: c.selection, skip: c.skipTargetFind };
      c.selection = false;
      c.skipTargetFind = true;
      parked = true;
    };
    const unpark = () => {
      if (!c) return;
      if (saved) { c.selection = saved.selection; c.skipTargetFind = saved.skip; saved = null; }
      parked = false;
      c.requestRenderAll?.();
    };

    const onPD = (e) => {
      if (textEditing) return;
      if (e.pointerType !== 'touch') return;
      if (!pA) { pA = { id: e.pointerId, x: e.clientX, y: e.clientY }; return; }
      if (!pB && e.pointerId !== pA.id) {
        pB = { id: e.pointerId, x: e.clientX, y: e.clientY };
        startDist = Math.hypot(pA.x - pB.x, pA.y - pB.y);
        startScale = readZ();
        park();
      }
    };

    const onPM = (e) => {
      if (textEditing) return;
      if (e.pointerType !== 'touch') return;
      if (pA && e.pointerId === pA.id) { pA.x = e.clientX; pA.y = e.clientY; }
      if (pB && e.pointerId === pB.id) { pB.x = e.clientX; pB.y = e.clientY; }
      if (pA && pB && startDist) {
        e.preventDefault();
        const d = Math.hypot(pA.x - pB.x, pA.y - pB.y);
        writeZ(startScale * Math.pow(d / startDist, 0.9));
      }
    };

    const onPU = (e) => {
      if (textEditing) return;
      if (e.pointerType !== 'touch') return;
      if (pA && e.pointerId === pA.id) pA = null;
      if (pB && e.pointerId === pB.id) pB = null;
      if (!(pA && pB)) { startDist = 0; startScale = 1; unpark(); }
    };

    const onCancel = () => { pA = pB = null; startDist = 0; startScale = 1; unpark(); };

    target.addEventListener('wheel', onWheel, { passive: false });
    target.addEventListener('pointerdown', onPD, { passive: true });
    target.addEventListener('pointermove', onPM, { passive: false, capture: true });
    window.addEventListener('pointerup', onPU, { passive: true });
    window.addEventListener('pointercancel', onCancel, { passive: true });
    document.addEventListener('visibilitychange', onCancel);
    window.addEventListener('blur', onCancel);

    return () => {
      target.removeEventListener('wheel', onWheel);
      target.removeEventListener('pointerdown', onPD);
      target.removeEventListener('pointermove', onPM, { capture: true });
      window.removeEventListener('pointerup', onPU);
      window.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('visibilitychange', onCancel);
      window.removeEventListener('blur', onCancel);
    };
  }, [stageRef, setZoom, textEditing]);

  // Bloquear clicks externos mientras se diseña
  useEffect(() => {
    const hostA = anchorRef?.current;
    const hostS = stageRef?.current;
    const host = hostA || hostS;
    if (!host) return;

   const getAllowed = () => {
      const c = fabricCanvasRef.current;
     return [overlayRef.current, c?.upperCanvasEl, menuRef.current].filter(Boolean);
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
    // importante: no interceptar 'click'
    const evs = ['pointerdown','mousedown','touchstart','wheel'];
    evs.forEach(ev => host.addEventListener(ev, stop, opts));

    return () => { evs.forEach(ev => host.removeEventListener(ev, stop, opts)); };
  }, [editing, anchorRef, stageRef]);

  // ===== Snapshots =====
  function exportDesignSnapshot() {
    const c = fabricCanvasRef.current; if (!c) return null;
    return { v: 2, baseSize, canvasJSON: c.toJSON(['_kind']) };
  }

async function applyDesignSnapshotToCanvas(snapshot) {
  if (!snapshot) return;
  const c = fabricCanvasRef.current; if (!c) return;
  const wasEditing = !!editing;

  isApplyingRef.current = true;
  try {
    // ... (c.loadFromJSON + ajustes)
    setSelType('none');
    setTextEditing(false);
    rearmInteractivity(wasEditing);
    if (wasEditing) setEditing(true);
    forceRepaint();
  } catch (err) {
    console.error('applyDesignSnapshotToCanvas error:', err);
  }
  isApplyingRef.current = false;
}


  // ===== Acciones =====
  const addText = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    const group = makeTextGroup('Nuevo párrafo', {
      width: Math.min(baseSize.w * 0.9, 220),
      fontSize, fontFamily, fontWeight: isBold ? '700' : 'normal',
      fontStyle: isItalic ? 'italic' : 'normal',
      underline: isUnderline, textAlign,
    });
    group.set({ left: baseSize.w/2, top: baseSize.h/2, originX: 'center', originY: 'center' });
    c.add(group);
    c.setActiveObject(group);
    setSelType('text');
    c.requestRenderAll();
    setEditing(true);
    const snap = exportDesignSnapshot(); if (snap) historyRef.current.push(snap);
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
      baseImg.set({ originX: 'center', originY: 'center', left: c.getWidth()/2, top: c.getHeight()/2, scaleX: s, scaleY: s, selectable: false, evented: false, objectCaching: false });
      const group = attachDebossToBase(c, baseImg, { offset: vecOffset });
      c.add(group);
      c.setActiveObject(group);
      setSelType('image');
      c.requestRenderAll();
      setEditing(true);
      const snap = exportDesignSnapshot(); if (snap) historyRef.current.push(snap);
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
      try { c.remove(active); } catch {}
      const baseImg = vectorizeElementToBitmap(src, { maxDim: VECTOR_SAMPLE_DIM, makeDark: !vecInvert, drawColor: [51,51,51], thrBias: vecBias });
      if (!baseImg) { URL.revokeObjectURL(url); return; }
      baseImg.set({ selectable: false, evented: false, objectCaching: false });
      const group = attachDebossToBase(c, baseImg, { offset: vecOffset });
      group.set(pose);
      c.add(group);
      c.setActiveObject(group);
      setSelType('image');
      c.requestRenderAll();
      setEditing(true);
      const snap = exportDesignSnapshot(); if (snap) historyRef.current.push(snap);
      URL.revokeObjectURL(url);
    };
    imgEl.onerror = () => URL.revokeObjectURL(url);
    imgEl.src = url;
  };

  // Borrar selección (grupos)
  const onDelete = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;

    const removeOne = (o) => { if (!o) return; try { c.remove(o); } catch {} };

    if (a.type === 'activeSelection' && a._objects?.length) {
      const arr = a._objects.slice();
      a.discard();
      arr.forEach(removeOne);
    } else {
      removeOne(a);
    }
    c.discardActiveObject();
    c.requestRenderAll();
    setSelType('none');
    const snap = exportDesignSnapshot(); if (snap) historyRef.current.push(snap);
  };

  const clearSelectionHard = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    try { c.getObjects().forEach(o => { if (o?.isEditing && typeof o.exitEditing === 'function') o.exitEditing(); }); } catch {}
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

  // Aplicar cambios tipográficos a selección (grupos de texto)
  const applyToSelection = (mutator) => {
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;

    const applyToGroup = (g) => {
      if (!g || g._kind !== 'textGroup') return;
      const { base, shadow, highlight } = g._textChildren || {};
      [base, shadow, highlight].forEach(o => o && mutator(o));
      const sx = Math.max(1e-6, Math.abs(g.scaleX || 1));
      const sy = Math.max(1e-6, Math.abs(g.scaleY || 1));
      const ox = 1 / sx, oy = 1 / sy;
      shadow?.set({ left: -ox, top: -oy });
      highlight?.set({ left: +ox, top: +oy });
      g.setCoords();
    };

    if (a.type === 'activeSelection' && Array.isArray(a._objects)) {
      a._objects.forEach(applyToGroup);
    } else if (a._kind === 'textGroup') {
      applyToGroup(a);
    } else if (a.type === 'textbox' || a.type === 'i-text' || a.type === 'text') {
      mutator(a);
    }
    c.requestRenderAll();
    const snap = exportDesignSnapshot(); if (snap) historyRef.current.push(snap);
  };

  // Re-vectorizar imagen al cambiar Detalles/Invertir
  useEffect(() => {
    if (!editing || selType !== 'image') return;
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;

    const rebuild = (obj) => {
      let element = null;
      let pose = null;

      if (obj?._kind === 'imgGroup') {
        const base = obj._imgChildren?.base;
        if (!base) return;
        element = base._vecSourceEl || (typeof base.getElement === 'function' ? base.getElement() : base._element);
        pose = { left: obj.left, top: obj.top, originX: obj.originX, originY: obj.originY, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle || 0 };
        try { obj.canvas.remove(obj); } catch {}
      } else if (obj?._vecSourceEl || obj?.type === 'image') {
        element = obj._vecSourceEl || (typeof obj.getElement === 'function' ? obj.getElement() : obj._element);
        pose = { left: obj.left, top: obj.top, originX: obj.originX, originY: obj.originY, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle || 0 };
        try { obj.canvas.remove(obj); } catch {}
      } else {
        return;
      }

      const baseImg = vectorizeElementToBitmap(element, { maxDim: VECTOR_SAMPLE_DIM, makeDark: !vecInvert, drawColor: [51,51,51], thrBias: vecBias });
      if (!baseImg) return;
      baseImg.set({ selectable: false, evented: false, objectCaching: false });

      const group = attachDebossToBase(c, baseImg, { offset: vecOffset });
      group.set(pose);
      c.add(group);
      c.setActiveObject(group);
    };

    if (a.type === 'activeSelection' && a._objects?.length) {
      const arr = a._objects.slice(); a.discard(); arr.forEach(rebuild);
    } else { rebuild(a); }

    c.requestRenderAll();
    const snap = exportDesignSnapshot(); if (snap) historyRef.current.push(snap);
  }, [vecBias, vecInvert]); // vecOffset tiene su propio efecto

  // Offset de relieve en caliente
  useEffect(() => {
    if (!editing || selType !== 'image') return;
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;
    const upd = (obj) => { if (obj._kind === 'imgGroup') updateDebossVisual(obj, { offset: vecOffset }); };
    if (a.type === 'activeSelection' && a._objects?.length) a._objects.forEach(upd); else upd(a);
    const snap = exportDesignSnapshot(); if (snap) historyRef.current.push(snap);
  }, [vecOffset, editing, selType]);

  if (!visible) return null;

  // ===== Overlay Canvas dentro de la maceta =====
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
      onPointerDown={(e) => { if (editing) { e.stopPropagation(); } }}
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

  // ===== Menú fijo =====
  function Menu() {
    return (
      <div
        ref={menuRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: 'rgba(253, 253, 253, 0.34)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          border: '1px solid #ddd',
          borderRadius: 12,
          padding: '10px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          width: 'auto',
          maxWidth: '94vw',
          fontSize: 12,
          userSelect: 'none'
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        {/* LÍNEA 1: Zoom + modos + Undo/Redo */}
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
            onPointerDown={(e)=>e.stopPropagation()}
            onClick={exitDesignMode}
            style={{ minWidth: '16ch' }}
          >
            Seleccionar Maceta
          </button>

          <button
            type="button"
            className={`btn ${editing ? 'btn-dark' : 'btn-outline-secondary'} text-nowrap`}
            onMouseDown={(e)=>e.preventDefault()}
            onPointerDown={(e)=>e.stopPropagation()}
            onClick={enterDesignMode}
            style={{ minWidth: '12ch' }}
          >
            Diseñar
          </button>

          {/* Undo / Redo */}
          <div className="d-flex gap-2 ms-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
onMouseDown={(e)=>e.stopPropagation()}
onClick={(e)=>{ e.stopPropagation(); const prev = historyRef.current.undo(); if (prev) applyDesignSnapshotToCanvas(prev); }}
onPointerDown={(e)=>e.stopPropagation()}
   
onClick={async () => {
   const prev = historyRef.current.undo();
   if (prev) await applyDesignSnapshotToCanvas(prev);
 }}

              disabled={!historyRef.current.canUndo?.()}
              title="Deshacer (Ctrl+Z)"
            >⟲</button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
onMouseDown={(e)=>e.stopPropagation()}
onClick={(e)=>{ e.stopPropagation(); const next = historyRef.current.redo(); if (next) applyDesignSnapshotToCanvas(next); }}
onPointerDown={(e)=>e.stopPropagation()}
 onClick={async () => {
   const next = historyRef.current.redo();
   if (next) await applyDesignSnapshotToCanvas(next);
 }}
              disabled={!historyRef.current.canRedo?.()}
              title="Rehacer (Ctrl+Y)"
            >⟳</button>
          </div>
        </div>

        {/* LÍNEA 2: Acciones básicas */}
        {editing && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="btn btn-sm btn-outline-secondary"
              onPointerDown={(e)=>e.stopPropagation()}
              onClick={addText}
              disabled={!ready}
            >
              + Texto
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onPointerDown={(e)=>e.stopPropagation()}
              onClick={() => addInputRef.current?.click()}
              disabled={!ready}
            >
              + Imagen
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onPointerDown={(e)=>e.stopPropagation()}
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
                    className={`btn ${isBold ? 'btn-dark' : 'btn-outline-secondary'}`}
                    onPointerDown={(e)=>e.stopPropagation()}
                    onClick={() => { const nv = !isBold; setIsBold(nv); applyToSelection(o => o.set({ fontWeight: nv ? '700' : 'normal' })); }}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    className={`btn ${isItalic ? 'btn-dark' : 'btn-outline-secondary'}`}
                    onPointerDown={(e)=>e.stopPropagation()}
                    onClick={() => { const nv = !isItalic; setIsItalic(nv); applyToSelection(o => o.set({ fontStyle: nv ? 'italic' : 'normal' })); }}
                  >
                    I
                  </button>
                  <button
                    type="button"
                    className={`btn ${isUnderline ? 'btn-dark' : 'btn-outline-secondary'}`}
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
                      const v = clamp(parseInt(e.target.value || '0', 10), 8, 200);
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
                    {textAlign === 'left' ? '⟸' : textAlign === 'center' ? '⟺' : textAlign === 'right' ? '⟹' : '≣'}
                  </button>
                  {showAlignMenu && (
                    <ul className="dropdown-menu show" style={{ position: 'absolute' }}>
                      {['left','center','right','justify'].map(a => (
                        <li key={a}>
                          <button
                            type="button"
                            className={`dropdown-item ${textAlign === a ? 'active' : ''}`}
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
            )}

            {selType === 'image' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
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
                  <button type="button" className={`btn ${!vecInvert ? 'btn-dark' : 'btn-outline-secondary'}`} onPointerDown={(e)=>e.stopPropagation()} onClick={() => setVecInvert(false)}>Oscuro</button>
                  <button type="button" className={`btn ${vecInvert ? 'btn-dark' : 'btn-outline-secondary'}`} onPointerDown={(e)=>e.stopPropagation()} onClick={() => setVecInvert(true)}>Claro</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Inputs ocultos */}
        <input
          ref={addInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) addImageFromFile(f); e.target.value=''; }}
          onPointerDown={(e)=>e.stopPropagation()}
          style={{ display: 'none' }}
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceActiveFromFile(f); e.target.value=''; }}
          onPointerDown={(e)=>e.stopPropagation()}
          style={{ display: 'none' }}
        />
      </div>
    );
  }

  // ===== Render =====
  return (
    <>
      {/* Overlay dentro de la maceta */}
      {stageRef?.current ? createPortal(OverlayCanvas, stageRef.current) : null}

      {/* Menú fijo abajo */}
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
