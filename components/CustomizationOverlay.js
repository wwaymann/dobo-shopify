// components/CustomizationOverlay.js
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { createPortal } from 'react-dom';
import { saveSessionDesign } from '../lib/designStore'; // <-- persistencia

/* ================= Constantes ================ */
const MAX_TEXTURE_DIM = 1600;
const VECTOR_SAMPLE_DIM = 500;
const Z_CANVAS = 4000;
const Z_MENU = 2147483647;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const FONT_OPTIONS = [
  { name: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { name: 'Georgia', css: 'Georgia, serif' },
  { name: 'Times New Roman', css: '"Times New Roman", Times, serif' },
  { name: 'Courier New', css: '"Courier New", Courier, monospace' },
  { name: 'Trebuchet MS', css: '"Trebuchet MS", Tahoma, sans-serif' },
  { name: 'Montserrat', css: 'Montserrat, Arial, sans-serif' },
  { name: 'Poppins', css: 'Poppins, Arial, sans-serif' },
];

/* ============== Clases Fabric personalizadas ============== */
fabric.TextRelief = fabric.util.createClass(fabric.Group, {
  type: 'textRelief',
  initialize: function (text = 'Texto', opts = {}) {
    const base = new fabric.Textbox(text, {
      originX: 'center', originY: 'center',
      shadow: null, stroke: null, objectCaching: false,
      selectable: false, evented: false, fill: 'rgba(35,35,35,1)',
      globalCompositeOperation: 'multiply',
      fontFamily: opts.fontFamily, fontSize: opts.fontSize, fontWeight: opts.fontWeight,
      fontStyle: opts.fontStyle, underline: opts.underline, textAlign: opts.textAlign,
      width: opts.width || 220,
    });
    const shadow = new fabric.Textbox(text, {
      originX: 'center', originY: 'center', left: -1, top: -1,
      objectCaching: false, selectable: false, evented: false,
      fill: '', stroke: 'rgba(0,0,0,0.48)', strokeWidth: 1,
      fontFamily: base.fontFamily, fontSize: base.fontSize, fontWeight: base.fontWeight,
      fontStyle: base.fontStyle, underline: base.underline, textAlign: base.textAlign,
      width: base.width, globalCompositeOperation: 'multiply'
    });
    const highlight = new fabric.Textbox(text, {
      originX: 'center', originY: 'center', left: +1, top: +1,
      objectCaching: false, selectable: false, evented: false,
      fill: '', stroke: 'rgba(255,255,255,0.65)', strokeWidth: 0.6,
      fontFamily: base.fontFamily, fontSize: base.fontSize, fontWeight: base.fontWeight,
      fontStyle: base.fontStyle, underline: base.underline, textAlign: base.textAlign,
      width: base.width, globalCompositeOperation: 'screen'
    });

    this.callSuper('initialize', [shadow, highlight, base], {
      originX: 'center', originY: 'center',
      objectCaching: false, subTargetCheck: false,
      selectable: true, evented: true, ...opts
    });

    this._textChildren = { shadow, highlight, base };
    this._reliefOffset = typeof opts.reliefOffset === 'number' ? opts.reliefOffset : 1;

    const sync = () => {
      const sx = Math.max(1e-6, Math.abs(this.scaleX || 1));
      const ox = this._reliefOffset / sx;
      shadow.set({ left: -ox, top: -ox });
      highlight.set({ left: +ox, top: +ox });
      this.setCoords();
      this.canvas?.requestRenderAll?.();
    };
    this.on('scaling', sync);
    this.on('modified', sync);
    sync();
  },
  toObject: function (props = []) {
    const b = this._textChildren?.base;
    return fabric.util.object.extend(this.callSuper('toObject', props), {
      text: b?.text || 'Texto',
      reliefOffset: this._reliefOffset,
      fontFamily: b?.fontFamily,
      fontSize: b?.fontSize,
      fontWeight: b?.fontWeight,
      fontStyle: b?.fontStyle,
      underline: b?.underline,
      textAlign: b?.textAlign,
      width: b?.width
    });
  }
});
fabric.TextRelief.fromObject = function (obj, cb) {
  const inst = new fabric.TextRelief(obj.text || 'Texto', {
    fontFamily: obj.fontFamily, fontSize: obj.fontSize,
    fontWeight: obj.fontWeight, fontStyle: obj.fontStyle,
    underline: obj.underline, textAlign: obj.textAlign, width: obj.width,
    reliefOffset: obj.reliefOffset || 1
  });
  inst.set(obj); inst._reliefOffset = obj.reliefOffset || 1; inst.setCoords();
  cb(inst);
};

fabric.ImageRelief = fabric.util.createClass(fabric.Group, {
  type: 'imageRelief',
  initialize: function (imgEl, opts = {}) {
    const make = () => new fabric.Image(imgEl, {
      originX: 'center', originY: 'center',
      objectCaching: false, selectable: false, evented: false, noScaleCache: true
    });
    const base = make(), shadow = make(), highlight = make();
    this.callSuper('initialize', [shadow, highlight, base], {
      originX: 'center', originY: 'center',
      objectCaching: false, subTargetCheck: false,
      selectable: true, evented: true, ...opts
    });
    this._imgChildren = { base, shadow, highlight };
    this._reliefOffset = typeof opts.reliefOffset === 'number' ? opts.reliefOffset : 1;
    this._srcDataURL = opts.srcDataURL || null;
    this._thrBias = typeof opts.thrBias === 'number' ? opts.thrBias : 0;
    this._makeDark = typeof opts.makeDark === 'boolean' ? opts.makeDark : true;

    shadow.set({ globalCompositeOperation: 'multiply', opacity: 1 });
    highlight.set({ globalCompositeOperation: 'screen', opacity: 1 });

    const normalize = () => {
      const sx = Math.max(1e-6, Math.abs(this.scaleX || 1));
      const ox = this._reliefOffset / sx;
      shadow.set({ left: -ox, top: -ox });
      highlight.set({ left: +ox, top: +ox });
      base.set({ left: 0, top: 0 });
      this.setCoords?.();
      this.canvas?.requestRenderAll?.();
    };
    this.on('scaling', normalize);
    this.on('modified', normalize);
    normalize();
  },
  toObject: function (props = []) {
    return fabric.util.object.extend(this.callSuper('toObject', props), {
      reliefOffset: this._reliefOffset,
      srcDataURL: this._srcDataURL,
      thrBias: this._thrBias,
      makeDark: this._makeDark
    });
  }
});
fabric.ImageRelief.fromObject = function (obj, cb) {
  const imgSrc = obj.srcDataURL; if (!imgSrc) { cb && cb(null); return; }
  fabric.util.loadImage(imgSrc, (imgEl) => {
    if (!imgEl) { cb && cb(null); return; }
    const inst = new fabric.ImageRelief(imgEl, {
      reliefOffset: obj.reliefOffset || 1,
      srcDataURL: imgSrc,
      thrBias: obj.thrBias || 0,
      makeDark: typeof obj.makeDark === 'boolean' ? obj.makeDark : true
    });
    inst.set(obj); inst.setCoords();
    cb(inst);
  }, null, { crossOrigin: 'anonymous' });
};
fabric.ImageRelief.async = true;

/* ============== Utilidades imagen/vectorización ============== */
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
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, varMax = -1, threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (wB === 0) continue;
    const wF = total - wB; if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF, diff = mB - mF;
    const between = wB * wF * diff * diff;
    if (Number.isFinite(between) && between > varMax) { varMax = between; threshold = t; }
  }
  return threshold;
};
function vectorizeToCanvas(element, { maxDim = VECTOR_SAMPLE_DIM, makeDark = true, drawColor = [51,51,51], thrBias = 0 } = {}) {
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

  let img; try { img = ctx.getImageData(0, 0, w, h); } catch { return null; }
  const data = img?.data; const total = w * h;
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
    if (keep) { data[i]=drawColor[0]; data[i+1]=drawColor[1]; data[i+2]=drawColor[2]; data[i+3]=255; }
    else { data[i+3]=0; }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/* =================== Componente =================== */
export default function CustomizationOverlay({
  stageRef,
  anchorRef,
  visible = true,
  zoom = 1,
  setZoom,
  // NUEVO: persistencia e hidratación
  initialDesign = null,
  productId = null,
  customerAccessToken = '',
  onDesignChanged = null,
}) {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const overlayRef = useRef(null);

  const addInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const menuRef = useRef(null);

  const [overlayBox, setOverlayBox] = useState({ left: 0, top: 0, w: 1, h: 1 });
  const [anchorRect, setAnchorRect] = useState(null);

  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [selType, setSelType] = useState('none');
  const [textEditing, setTextEditing] = useState(false);
  const suppressSelectionRef = useRef(false);

  // Tipografía
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].css);
  const [fontSize, setFontSize] = useState(60);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState('center');
  const [showAlignMenu, setShowAlignMenu] = useState(false);

  // Imagen / relieve
  const [vecOffset, setVecOffset] = useState(1);
  const [vecInvert, setVecInvert] = useState(false);
  const [vecBias, setVecBias] = useState(0);

  // Historial
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const isRestoringRef = useRef(false);
  const lastSnapRef = useRef(null);
  const saveTimerRef = useRef(null);

  /* ---------- helpers ---------- */
  const snapshotNow = () => {
    const c = fabricCanvasRef.current; if (!c) return null;
    try { return JSON.stringify(c.toJSON()); } catch { return null; }
  };
  const persistIfConfigured = () => {
    if (!productId) return;
    const s = snapshotNow(); if (!s) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        const json = JSON.parse(s);
        saveSessionDesign(productId, json, customerAccessToken);
      } catch {}
    }, 600);
  };
  const notifyExternal = () => {
    if (typeof onDesignChanged === 'function') {
      try { onDesignChanged(); } catch {}
    }
  };
  const pushUndo = () => {
    if (isRestoringRef.current) return;
    const s = snapshotNow();
    if (!s || s === lastSnapRef.current) return;
    undoRef.current.push(s);
    if (undoRef.current.length > 80) undoRef.current.shift();
    redoRef.current = [];
    lastSnapRef.current = s;
    persistIfConfigured();
    notifyExternal();
  };
  const canUndo = () => undoRef.current.length > 1; // al menos un estado previo
  const canRedo = () => redoRef.current.length > 0;

  const applyInteractivityByMode = (on) => {
    const c = fabricCanvasRef.current; if (!c) return;
    const enableNode = (o, onNode) => {
      if (!o) return;
      const isRelief = o.type === 'textRelief' || o.type === 'imageRelief';
      o.selectable = onNode;
      o.evented = onNode;
      o.lockMovementX = !onNode;
      o.lockMovementY = !onNode;
      o.hasControls = onNode;
      o.hasBorders = onNode;
      if (!isRelief && (o.type === 'i-text' || typeof o.enterEditing === 'function')) o.editable = onNode;
      o.hoverCursor = onNode ? 'move' : 'default';
      const children = o._objects || (typeof o.getObjects === 'function' ? o.getObjects() : null);
      if (Array.isArray(children)) children.forEach(ch => enableNode(ch, onNode));
    };
    c.skipTargetFind = !on;
    c.selection = on;
    (c.getObjects?.() || []).forEach(o => enableNode(o, on));
    const upper = c.upperCanvasEl, lower = c.lowerCanvasEl;
    if (upper) { upper.style.pointerEvents = on ? 'auto' : 'none'; upper.style.touchAction = on ? 'none' : 'auto'; upper.tabIndex = on ? 0 : -1; }
    if (lower) { lower.style.pointerEvents = 'none'; lower.style.touchAction = 'none'; }
    c.defaultCursor = on ? 'move' : 'default';
    try { c.discardActiveObject(); } catch {}
    c.calcOffset?.(); c.requestRenderAll?.();
    setTimeout(() => { c.calcOffset?.(); c.requestRenderAll?.(); }, 0);
  };

  const restoreSnapshot = (s) => {
    const c = fabricCanvasRef.current; if (!c || !s) return;
    isRestoringRef.current = true;
    c.loadFromJSON(JSON.parse(s), () => {
      applyInteractivityByMode(editing);
      (c.getObjects() || []).forEach(o => {
        if (o.type === 'i-text' || o.type === 'textbox') o.editable = true;
        o.dirty = true;
      });
      c.discardActiveObject(); c.requestRenderAll(); c.calcOffset?.();
      setTimeout(() => { c.requestRenderAll?.(); }, 0);
      setSelType('none');
      lastSnapRef.current = snapshotNow();
      isRestoringRef.current = false;
      notifyExternal();
    });
  };
  const doUndo = () => {
    if (!canUndo()) return;
    const curr = snapshotNow();
    undoRef.current.pop(); // descarta el actual
    const target = undoRef.current[undoRef.current.length - 1];
    if (curr) redoRef.current.push(curr);
    restoreSnapshot(target);
  };
  const doRedo = () => {
    if (!canRedo()) return;
    const curr = snapshotNow();
    const next = redoRef.current.pop();
    if (curr) undoRef.current.push(curr);
    restoreSnapshot(next);
  };

  /* ------ Inicializar Fabric ------ */
  useEffect(() => {
    if (!visible || !canvasRef.current || fabricCanvasRef.current) return;
    const c = new fabric.Canvas(canvasRef.current, {
      width: 1, height: 1, preserveObjectStacking: true,
      selection: true, perPixelTargetFind: true, targetFindTolerance: 8, renderOnAddRemove: true
    });
    fabricCanvasRef.current = c;

    const isTextObj = (o) =>
      o && (o.type === 'i-text' || o.type === 'textbox' || o.type === 'text' || o.type === 'textRelief');

    const classify = (a) => {
      if (!a) return 'none';
      if (a.type === 'imageRelief') return 'image';
      if (a.type === 'textRelief' || a.type === 'i-text' || a.type === 'textbox' || a.type === 'text') return 'text';
      if (a.type === 'activeSelection' && a._objects?.length) {
        if (a._objects.every(o => o.type === 'textRelief')) return 'text';
        if (a._objects.some(o => o.type === 'imageRelief')) return 'image';
      }
      return 'none';
    };

    const reflectTypo = () => {
      const a = c.getActiveObject(); if (!a) return;
      let first = null;
      if (a.type === 'textRelief') first = a._textChildren?.base || null;
      else if (a.type === 'activeSelection') first = a._objects?.find(x => x.type === 'textRelief')?._textChildren?.base || null;
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
        setSelType('none'); c.requestRenderAll(); return;
      }
      setSelType(classify(cobj));
      reflectTypo();
    };
    c.on('selection:created', onSel);
    c.on('selection:updated', onSel);
    c.on('selection:cleared', () => setSelType('none'));

    c.on('mouse:dblclick', (e) => {
      if (!e || !e.e || e.e.pointerType === 'touch') return;
      const t = e.target;
      if (t?.type === 'textRelief') startInlineTextEdit(t);
      else if ((t?.type === 'textbox' || t?.type === 'i-text' || t?.type === 'text') && typeof t.enterEditing === 'function') {
        t.enterEditing(); c.requestRenderAll();
      }
    });

    const onAdded = () => pushUndo();
    const onModified = () => pushUndo();
    const onRemoved = () => pushUndo();
    c.on('object:added', onAdded);
    c.on('object:modified', onModified);
    c.on('object:removed', onRemoved);

    // Hidratación inicial
    const initFirstState = () => {
      if (initialDesign) {
        try {
          isRestoringRef.current = true;
          c.loadFromJSON(initialDesign, () => {
            (c.getObjects() || []).forEach(o => {
              if (o.type === 'i-text' || o.type === 'textbox') o.editable = true;
            });
            c.renderAll();
            const s = snapshotNow();
            undoRef.current = s ? [s] : [];
            redoRef.current = [];
            lastSnapRef.current = s || null;
            isRestoringRef.current = false;
            notifyExternal();
            persistIfConfigured(); // guarda de arranque si aplica
          });
          return;
        } catch {}
      }
      const s = snapshotNow();
      undoRef.current = s ? [s] : [];
      redoRef.current = [];
      lastSnapRef.current = s || null;
      notifyExternal();
      persistIfConfigured();
    };
    initFirstState();

    setReady(true);
    return () => {
      c.off('mouse:dblclick');
      c.off('selection:created', onSel);
      c.off('selection:updated', onSel);
      c.off('selection:cleared');
      c.off('object:added', onAdded);
      c.off('object:modified', onModified);
      c.off('object:removed', onRemoved);
      try { c.dispose(); } catch {}
      fabricCanvasRef.current = null;
    };
  }, [visible, initialDesign, productId, customerAccessToken]);

  /* ------ TouchAction según edición de texto ------ */
  useEffect(() => {
    const c = fabricCanvasRef.current;
    const upper = c?.upperCanvasEl;
    if (!upper) return;
    upper.style.touchAction = textEditing ? 'auto' : (editing ? 'none' : 'auto');
  }, [textEditing, editing]);

  /* ------ Mantener --zoom ------ */
  useEffect(() => {
    const v = typeof zoom === 'number' ? zoom : 1;
    stageRef?.current?.style.setProperty('--zoom', String(v));
  }, [zoom, stageRef]);

  /* ------ Medición y tamaño del canvas sobre anchor ------ */
  useLayoutEffect(() => {
    const stage = stageRef?.current;
    const anchor = anchorRef?.current;
    if (!stage || !anchor) return;

    const ensureRelative = () => {
      const prev = anchor.style.position;
      if (getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';
      return () => { try { anchor.style.position = prev; } catch {} };
    };
    const revert = ensureRelative();

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
      revert();
      try { roA.disconnect(); } catch {}
      try { roS.disconnect(); } catch {}
      window.removeEventListener('resize', measure);
    };
  }, [stageRef, anchorRef]);

  /* ------ Posición del menú (para centrar) ------ */
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

  /* ------ Activar/desactivar edición ------ */
  useEffect(() => { applyInteractivityByMode(!!editing); }, [editing]);

  /* ------ Atajos undo/redo ------ */
  useEffect(() => {
    const onKey = (e) => {
      const isInput = e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA' || e.target?.isContentEditable;
      if (isInput || textEditing) return;
      const mod = e.metaKey || e.ctrlKey; if (!mod) return;
      const k = e.key.toLowerCase();
      if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); doRedo(); return; }
      if (k === 'z') { e.preventDefault(); doUndo(); }
    };
    window.addEventListener('keydown', onKey, { passive: false });
    return () => window.removeEventListener('keydown', onKey);
  }, [textEditing]);

  /* ------ Gestos de zoom ------ */
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
    const onWheel = (e) => { if (textEditing) return; e.preventDefault(); writeZ(readZ() + (e.deltaY > 0 ? -0.08 : 0.08)); };

    let pA = null, pB = null, startDist = 0, startScale = 1, parked = false, saved = null;
    const park = () => { if (parked || !c) return; saved = { selection: c.selection, skip: c.skipTargetFind }; c.selection = false; c.skipTargetFind = true; parked = true; };
    const unpark = () => { if (!c) return; if (saved) { c.selection = saved.selection; c.skipTargetFind = saved.skip; saved = null; } parked = false; c.requestRenderAll?.(); };
    const onPD = (e) => {
      if (textEditing || e.pointerType !== 'touch') return;
      if (!pA) { pA = { id: e.pointerId, x: e.clientX, y: e.clientY }; return; }
      if (!pB && e.pointerId !== pA.id) {
        pB = { id: e.pointerId, x: e.clientX, y: e.clientY };
        startDist = Math.hypot(pA.x - pB.x, pA.y - pB.y);
        startScale = readZ();
        park();
      }
    };
    const onPM = (e) => {
      if (textEditing || e.pointerType !== 'touch') return;
      if (pA && e.pointerId === pA.id) { pA.x = e.clientX; pA.y = e.clientY; }
      if (pB && e.pointerId === pB.id) { pB.x = e.clientX; pB.y = e.clientY; }
      if (pA && pB && startDist) {
        e.preventDefault();
        const d = Math.hypot(pA.x - pB.x, pA.y - pB.y);
        writeZ(startScale * Math.pow(d / startDist, 0.9));
      }
    };
    const onPU = (e) => {
      if (textEditing || e.pointerType !== 'touch') return;
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

  /* ------ Bloquear clics fuera del overlay solo cuando editing=true ------ */
  useEffect(() => {
    const host = anchorRef?.current || stageRef?.current;
    if (!host) return;
    const allowed = () => {
      const c = fabricCanvasRef.current;
      return [overlayRef.current, c?.upperCanvasEl].filter(Boolean);
    };
    const insideAllowed = (e) => {
      const path = e.composedPath ? e.composedPath() : [];
      return path.some(n => allowed().includes(n));
    };
    const stop = (e) => {
      if (!editing) return;
      if (insideAllowed(e)) return;
      e.preventDefault(); e.stopPropagation();
    };
    const opts = { capture: true, passive: false };
    const evs = ['pointerdown', 'mousedown', 'touchstart', 'click', 'wheel'];
    evs.forEach(ev => host.addEventListener(ev, stop, opts));
    return () => { evs.forEach(ev => host.removeEventListener(ev, stop, opts)); };
  }, [editing, anchorRef, stageRef]);

  /* ------------- Edición inline de texto ------------- */
  const startInlineTextEdit = (textRelief) => {
    const c = fabricCanvasRef.current; if (!c || !textRelief || textRelief.type !== 'textRelief') return;
    const base = textRelief._textChildren?.base; if (!base) return;

    const pose = {
      left: textRelief.left, top: textRelief.top, originX: 'center', originY: 'center',
      scaleX: textRelief.scaleX || 1, scaleY: textRelief.scaleY || 1, angle: textRelief.angle || 0
    };

    try { c.remove(textRelief); } catch {}

    const tb = new fabric.Textbox(base.text || 'Texto', {
      left: pose.left, top: pose.top, originX: 'center', originY: 'center',
      width: Math.min(c.getWidth() * 0.9, base.width || 220),
      fontFamily: base.fontFamily, fontSize: base.fontSize, fontWeight: base.fontWeight,
      fontStyle: base.fontStyle, underline: base.underline, textAlign: base.textAlign,
      editable: true, selectable: true, evented: true, objectCaching: false
    });

    c.add(tb); c.setActiveObject(tb); c.requestRenderAll();
    setTextEditing(true);

    setTimeout(() => {
      try { tb.enterEditing?.(); tb.hiddenTextarea?.focus(); } catch {}
    }, 0);

    const finish = () => {
      const newText = tb.text || '';
      const finalPose = { left: tb.left, top: tb.top, originX: tb.originX, originY: tb.originY, scaleX: tb.scaleX, scaleY: tb.scaleY, angle: tb.angle };
      try { c.remove(tb); } catch {}
      const group2 = new fabric.TextRelief(newText, {
        width: tb.width,
        fontFamily: tb.fontFamily, fontSize: tb.fontSize, fontWeight: tb.fontWeight,
        fontStyle: tb.fontStyle, underline: tb.underline, textAlign: tb.textAlign
      });
      group2.set(finalPose);
      c.add(group2); c.setActiveObject(group2); c.requestRenderAll();
      setSelType('text'); setTextEditing(false); pushUndo();
    };

    const onExit = () => { tb.off('editing:exited', onExit); finish(); };
    tb.on('editing:exited', onExit);

    const safety = setTimeout(() => {
      try { tb.off('editing:exited', onExit); } catch {}
      finish();
    }, 15000);
    tb.on('removed', () => { clearTimeout(safety); });
  };

  /* ---------------- Acciones ---------------- */
  const addText = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    const group = new fabric.TextRelief('Nuevo párrafo', {
      width: Math.min(c.getWidth() * 0.9, 220),
      fontSize, fontFamily, fontWeight: isBold ? '700' : 'normal',
      fontStyle: isItalic ? 'italic' : 'normal', underline: isUnderline, textAlign,
    });
    group.set({ left: c.getWidth()/2, top: c.getHeight()/2, originX: 'center', originY: 'center' });
    c.add(group); c.setActiveObject(group); setSelType('text'); c.requestRenderAll(); setEditing(true); pushUndo();
  };

  const addImageFromFile = (file) => {
    const c = fabricCanvasRef.current; if (!c || !file) return;
    const url = URL.createObjectURL(file);
    const imgEl = new Image(); imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => {
      const src = downscale(imgEl);
      const vecCanvas = vectorizeToCanvas(src, { maxDim: VECTOR_SAMPLE_DIM, makeDark: !vecInvert, drawColor: [51,51,51], thrBias: vecBias });
      if (!vecCanvas) { URL.revokeObjectURL(url); return; }
      const dataURL = vecCanvas.toDataURL('image/png');
      fabric.util.loadImage(dataURL, (loaded) => {
        if (!loaded) { URL.revokeObjectURL(url); return; }
        const maxW = c.getWidth() * 0.8, maxH = c.getHeight() * 0.8;
        const s = Math.min(maxW / vecCanvas.width, maxH / vecCanvas.height);
        const group = new fabric.ImageRelief(loaded, {
          reliefOffset: vecOffset, srcDataURL: dataURL, thrBias: vecBias, makeDark: !vecInvert
        });
        group.set({ originX: 'center', originY: 'center', left: c.getWidth()/2, top: c.getHeight()/2, scaleX: s, scaleY: s });
        c.add(group); c.setActiveObject(group); setSelType('image'); c.requestRenderAll(); setEditing(true); pushUndo();
        URL.revokeObjectURL(url);
      }, null, { crossOrigin: 'anonymous' });
    };
    imgEl.onerror = () => URL.revokeObjectURL(url);
    imgEl.src = url;
  };

  const replaceActiveFromFile = (file) => {
    const c = fabricCanvasRef.current; if (!c || !file) return;
    const active = c.getActiveObject(); if (!active || active.type !== 'imageRelief') return;
    const url = URL.createObjectURL(file);
    const imgEl = new Image(); imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => {
      const src = downscale(imgEl);
      const vecCanvas = vectorizeToCanvas(src, { maxDim: VECTOR_SAMPLE_DIM, makeDark: !vecInvert, drawColor: [51,51,51], thrBias: vecBias });
      if (!vecCanvas) { URL.revokeObjectURL(url); return; }
      const dataURL = vecCanvas.toDataURL('image/png');
      fabric.util.loadImage(dataURL, (loaded) => {
        if (!loaded) { URL.revokeObjectURL(url); return; }
        const pose = { left: active.left, top: active.top, originX: active.originX, originY: active.originY, scaleX: active.scaleX, scaleY: active.scaleY, angle: active.angle || 0 };
        try { c.remove(active); } catch {}
        const group = new fabric.ImageRelief(loaded, {
          reliefOffset: vecOffset, srcDataURL: dataURL, thrBias: vecBias, makeDark: !vecInvert
        });
        group.set(pose);
        c.add(group); c.setActiveObject(group); setSelType('image'); c.requestRenderAll(); setEditing(true); pushUndo();
        URL.revokeObjectURL(url);
      }, null, { crossOrigin: 'anonymous' });
    };
    imgEl.onerror = () => URL.revokeObjectURL(url);
    imgEl.src = url;
  };

  const onDelete = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;
    const removeOne = (o) => { if (!o) return; try { c.remove(o); } catch {} };
    if (a.type === 'activeSelection' && a._objects?.length) {
      const arr = a._objects.slice(); a.discard(); arr.forEach(removeOne);
    } else { removeOne(a); }
    c.discardActiveObject(); c.requestRenderAll(); setSelType('none'); pushUndo();
  };

  const applyToSelection = (mutator) => {
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;
    const applyToRelief = (g) => {
      if (g.type !== 'textRelief') return;
      const { base, shadow, highlight } = g._textChildren || {};
      [base, shadow, highlight].forEach(o => o && mutator(o));
      const sx = Math.max(1e-6, Math.abs(g.scaleX || 1));
      const ox = 1 / sx;
      shadow?.set({ left: -ox, top: -ox });
      highlight?.set({ left: +ox, top: +ox });
      g.setCoords();
    };
    if (a.type === 'activeSelection' && Array.isArray(a._objects)) a._objects.forEach(applyToRelief);
    else if (a.type === 'textRelief') applyToRelief(a);
    else if (a.type === 'textbox' || a.type === 'i-text' || a.type === 'text') mutator(a);
    c.requestRenderAll(); pushUndo();
  };

  // Re-procesado imagen ante cambios de parámetros
  useEffect(() => {
    if (!editing || selType !== 'image') return;
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;

    const rebuild = (obj) => {
      if (obj?.type !== 'imageRelief') return;
      const src = obj._srcDataURL; if (!src) return;
      fabric.util.loadImage(src, (imgEl) => {
        if (!imgEl) return;
        const pose = { left: obj.left, top: obj.top, originX: obj.originX, originY: obj.originY, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle || 0 };
        try { c.remove(obj); } catch {}
        const tmpImg = new Image(); tmpImg.crossOrigin = 'anonymous';
        tmpImg.onload = () => {
          const vecCanvas = vectorizeToCanvas(tmpImg, { maxDim: VECTOR_SAMPLE_DIM, makeDark: !vecInvert, drawColor: [51,51,51], thrBias: vecBias });
          if (!vecCanvas) return;
          const dataURL = vecCanvas.toDataURL('image/png');
          fabric.util.loadImage(dataURL, (loaded) => {
            if (!loaded) return;
            const g = new fabric.ImageRelief(loaded, {
              reliefOffset: vecOffset, srcDataURL: dataURL, thrBias: vecBias, makeDark: !vecInvert
            });
            g.set(pose);
            c.add(g);
            c.setActiveObject(g);
            c.requestRenderAll();
            pushUndo();
          }, null, { crossOrigin: 'anonymous' });
        };
        tmpImg.src = src;
      }, null, { crossOrigin: 'anonymous' });
    };

    if (a.type === 'activeSelection' && a._objects?.length) {
      const arr = a._objects.slice(); a.discard(); arr.forEach(rebuild);
    } else { rebuild(a); }
  }, [vecBias, vecInvert]);

  // Offset de relieve en caliente
  useEffect(() => {
    if (!editing || selType !== 'image') return;
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;

    const upd = (obj) => {
      if (obj.type !== 'imageRelief') return;
      obj._reliefOffset = vecOffset;
      const { shadow, highlight } = obj._imgChildren || {};
      if (shadow && highlight) {
        const sx = Math.max(1e-6, Math.abs(obj.scaleX || 1));
        const ox = obj._reliefOffset / sx;
        shadow.set({ left: -ox, top: -ox });
        highlight.set({ left: +ox, top: +ox });
        obj.setCoords();
      }
    };
    if (a.type === 'activeSelection' && a._objects?.length) a._objects.forEach(upd); else upd(a);
    c.requestRenderAll(); pushUndo();
  }, [vecOffset, editing, selType]);

  if (!visible) return null;

  /* ---------------- Overlay Canvas ---------------- */
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
      onPointerDown={(e) => { if (editing) e.stopPropagation(); }}
    >
      <canvas
        data-dobo-design="1"
        ref={canvasRef}
        width={overlayBox.w}
        height={overlayBox.h}
        style={{ width: '100%', height: '100%', display: 'block', background: 'transparent', touchAction: editing ? 'none' : 'auto' }}
      />
    </div>
  );

  /* ---------------- Menú ---------------- */
  function Menu() {
    return (
      <div
        ref={menuRef}
        style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          background: 'rgba(253,253,253,0.96)', backdropFilter: 'blur(4px)',
          border: '1px solid #ddd', borderRadius: 12, padding: '10px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: 'auto', maxWidth: '94vw', fontSize: 12,
          userSelect: 'none'
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        {/* LÍNEA 1: Historial + Zoom + Modos */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="btn-group btn-group-sm" role="group" aria-label="Historial">
            <button type="button" className="btn btn-outline-secondary" onPointerDown={(e)=>e.stopPropagation()} onClick={doUndo} disabled={!canUndo()} title="Deshacer">↶</button>
            <button type="button" className="btn btn-outline-secondary" onPointerDown={(e)=>e.stopPropagation()} onClick={doRedo} disabled={!canRedo()} title="Rehacer">↷</button>
          </div>

          {typeof setZoom === 'function' && (
            <div className="input-group input-group-sm" style={{ width: 180 }}>
              <span className="input-group-text">Zoom</span>
              <button type="button" className="btn btn-outline-secondary" onClick={() => setZoom(z => Math.max(0.8, +(z - 0.1).toFixed(2)))}>−</button>
              <input type="text" readOnly className="form-control form-control-sm text-center" value={`${Math.round((zoom || 1) * 100)}%`} />
              <button type="button" className="btn btn-outline-secondary" onClick={() => setZoom(z => Math.min(2.5, +(z + 0.1).toFixed(2)))}>+</button>
            </div>
          )}

          <button
            type="button"
            className={`btn ${!editing ? 'btn-dark' : 'btn-outline-secondary'} text-nowrap`}
            onMouseDown={(e)=>e.preventDefault()}
            onPointerDown={(e)=>e.stopPropagation()}
            onClick={() => { suppressSelectionRef.current = true; setEditing(false); setTimeout(()=>{ suppressSelectionRef.current = false; }, 120); }}
            style={{ minWidth: '16ch' }}
          >
            Seleccionar Maceta
          </button>

          <button
            type="button"
            className={`btn ${editing ? 'btn-dark' : 'btn-outline-secondary'} text-nowrap`}
            onMouseDown={(e)=>e.preventDefault()}
            onPointerDown={(e)=>e.stopPropagation()}
            onClick={() => { suppressSelectionRef.current = true; setEditing(true); setTimeout(()=>{ suppressSelectionRef.current = false; }, 120); }}
            style={{ minWidth: '12ch' }}
          >
            Diseñar
          </button>
        </div>

        {/* LÍNEA 2: Acciones */}
        {editing && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="btn btn-sm btn-outline-secondary" onPointerDown={(e)=>e.stopPropagation()} onClick={addText} disabled={!ready}>+ Texto</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onPointerDown={(e)=>e.stopPropagation()} onClick={() => addInputRef.current?.click()} disabled={!ready}>+ Imagen</button>
            <button type="button" className="btn btn-sm btn-outline-danger" onPointerDown={(e)=>e.stopPropagation()} onClick={onDelete} disabled={!ready || selType === 'none'}>Borrar</button>
          </div>
        )}

        {/* LÍNEA 3: Propiedades */}
        {editing && (
          <>
            {selType === 'text' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <div className="input-group input-group-sm" style={{ maxWidth: 220 }}>
                  <span className="input-group-text">Fuente</span>
                  <select className="form-select form-select-sm" value={fontFamily}
                    onChange={(e) => { const v = e.target.value; setFontFamily(v); applyToSelection(o => o.set({ fontFamily: v })); }}
                    onPointerDown={(e)=>e.stopPropagation()}>
                    {FONT_OPTIONS.map(f => (<option key={f.name} value={f.css} style={{ fontFamily: f.css }}>{f.name}</option>))}
                  </select>
                </div>

                <div className="btn-group btn-group-sm" role="group" aria-label="Estilos">
                  <button type="button" className={`btn ${isBold ? 'btn-dark' : 'btn-outline-secondary'}`} onPointerDown={(e)=>e.stopPropagation()}
                    onClick={() => { const nv = !isBold; setIsBold(nv); applyToSelection(o => o.set({ fontWeight: nv ? '700' : 'normal' })); }}>B</button>
                  <button type="button" className={`btn ${isItalic ? 'btn-dark' : 'btn-outline-secondary'}`} onPointerDown={(e)=>e.stopPropagation()}
                    onClick={() => { const nv = !isItalic; setIsItalic(nv); applyToSelection(o => o.set({ fontStyle: nv ? 'italic' : 'normal' })); }}>I</button>
                  <button type="button" className={`btn ${isUnderline ? 'btn-dark' : 'btn-outline-secondary'}`} onPointerDown={(e)=>e.stopPropagation()}
                    onClick={() => { const nv = !isUnderline; setIsUnderline(nv); applyToSelection(o => o.set({ underline: nv })); }}>U</button>
                </div>

                <div className="input-group input-group-sm" style={{ width: 160 }}>
                  <span className="input-group-text">Tamaño</span>
                  <input type="number" className="form-control form-control-sm" min={8} max={200} step={1} value={fontSize}
                    onPointerDown={(e)=>e.stopPropagation()}
                    onChange={(e) => { const v = clamp(parseInt(e.target.value || '0', 10), 8, 200); setFontSize(v); applyToSelection(o => o.set({ fontSize: v })); }} />
                </div>

                <div className="btn-group dropup">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onPointerDown={(e)=>e.stopPropagation()} onClick={() => setShowAlignMenu(v => !v)}>
                    {textAlign === 'left' ? '⟸' : textAlign === 'center' ? '⟺' : textAlign === 'right' ? '⟹' : '≣'}
                  </button>
                  {showAlignMenu && (
                    <ul className="dropdown-menu show" style={{ position: 'absolute' }}>
                      {['left','center','right','justify'].map(a => (
                        <li key={a}>
                          <button type="button" className={`dropdown-item ${textAlign === a ? 'active' : ''}`}
                            onPointerDown={(e)=>e.stopPropagation()}
                            onClick={() => { setTextAlign(a); setShowAlignMenu(false); applyToSelection(o => o.set({ textAlign: a })); }}>
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
        <input ref={addInputRef} type="file" accept="image/*"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) addImageFromFile(f); e.target.value=''; }}
          onPointerDown={(e)=>e.stopPropagation()} style={{ display: 'none' }} />
        <input ref={replaceInputRef} type="file" accept="image/*"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceActiveFromFile(f); e.target.value=''; }}
          onPointerDown={(e)=>e.stopPropagation()} style={{ display: 'none' }} />
      </div>
    );
  }

  /* ---------------- Render ---------------- */
  return (
    <>
      {stageRef?.current ? createPortal(OverlayCanvas, stageRef.current) : null}
      {createPortal(
        <div
          style={{
            position: 'fixed',
            left: anchorRect ? (anchorRect.left + anchorRect.width / 2) : '50%',
            bottom: 12,
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
      )}
    </>
  );
}

<CustomizationOverlay
  stageRef={stageRef}
  anchorRef={anchorRef}
  zoom={zoom}
  setZoom={setZoom}
  initialDesign={initialDesign}                 // objeto JSON del diseño
  productId={product?.id}                       // id del producto
  customerAccessToken={localStorage.getItem('customerAccessToken') || ''}
  onDesignChanged={() => {/* si quieres actualizar botones externos */}}
/>
