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

  // Mantener --zoom actualizado
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

      // posición relativa al stage con offsetParents (sin rects para no mezclar zoom)
      let left = 0, top = 0, el = anchor;
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

    if (typeof window !== 'undefined') {
      window.doboDesignAPI = {
        toPNG: (mult = 3) => c.toDataURL({ format: 'png', multiplier: mult, backgroundColor: 'transparent' }),
        toSVG: () => c.toSVG({ suppressPreamble: true }),
        getCanvas: () => c,
      };
    }

    // Helpers
    const isText = (o) => o && (o.type === 'i-text' || o.type === 'textbox' || o.type === 'text');

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
      if (isText(a)) return 'text';
      return 'none';
    };

    const reflectTypo = () => {
      const a = c.getActiveObject();
      let base = null;
      if (!a) return;
      if (a._kind === 'textGroup') {
        base = a._textChildren?.base || null;
      } else if (a.type === 'activeSelection') {
        const g = a._objects?.find(o => o._kind === 'textGroup');
        base = g?._textChildren?.base || null;
      } else if (isText(a)) {
        base = a;
      }
      if (base) {
        setFontFamily(base.fontFamily || FONT_OPTIONS[0].css);
        setFontSize(base.fontSize || 60);
        setIsBold((base.fontWeight + '' === '700') || base.fontWeight === 'bold');
        setIsItalic((base.fontStyle + '' === 'italic'));
        setIsUnderline(!!base.underline);
        setTextAlign(base.textAlign || 'center');
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

    // Doble clic: editar texto de grupos (lift-to-edit)
    c.on('mouse:dblclick', (e) => {
      const t = e.target;
      if (t && t._kind === 'textGroup' && t._textChildren?.base) {
        const g = t;
        const base = g._textChildren.base;

        const edit = new fabric.Textbox(base.text, {
          left: g.left, top: g.top, angle: g.angle || 0,
          originX: 'center', originY: 'center',
          width: base.width,
          fontFamily: base.fontFamily, fontSize: base.fontSize,
          fontWeight: base.fontWeight, fontStyle: base.fontStyle,
          underline: base.underline, textAlign: base.textAlign,
          charSpacing: base.charSpacing,
          selectable: true, evented: true, editable: true,
          objectCaching: false
        });

        g.visible = false;
        c.add(edit);
        c.setActiveObject(edit);
        edit.enterEditing(); edit.selectAll?.();
        c.requestRenderAll();

        const finish = () => {
          const props = ['text','fontFamily','fontSize','fontWeight','fontStyle','underline','textAlign','charSpacing','width'];
          props.forEach(p => base.set(p, edit[p]));
          g.left = edit.left; g.top = edit.top;
          g.scaleX = edit.scaleX; g.scaleY = edit.scaleY;
          g.angle = edit.angle || 0;
          g.visible = true;
          c.remove(edit);
          g._debossSync && g._debossSync();
          c.setActiveObject(g);
          c.requestRenderAll();
          edit.off('editing:exited', finish);
        };

        edit.on('editing:exited', finish);
        return;
      }

      // Texto suelto (compat)
      if (t && isText(t) && typeof t.enterEditing === 'function') {
        t.editable = true;
        c.setActiveObject(t);
        t.enterEditing(); t.selectAll?.();
        c.requestRenderAll();
      }
    });

    setReady(true);

    return () => {
      c.off('selection:created', onSel);
      c.off('selection:updated', onSel);
      c.off('selection:cleared');
      c.off('mouse:dblclick');
      try { c.dispose(); } catch {}
      fabricCanvasRef.current = null;
    };
  }, [visible]);

  // Ajusta tamaño del lienzo
  useEffect(() => {
    const c = fabricCanvasRef.current;
    if (!c) return;
    c.setWidth(baseSize.w);
    c.setHeight(baseSize.h);
    c.calcOffset?.();
    c.requestRenderAll?.();
  }, [baseSize.w, baseSize.h]);

  // ===== Utilidades de Relieve (agrupados) =====
  const attachDebossToBase = (c, baseObj, { offset = 1 } = {}) => {
    const element = (typeof baseObj.getElement === 'function' ? baseObj.getElement() : baseObj._element);
    const mk = () => new fabric.Image(element, {
      originX: 'center', originY: 'center',
      objectCaching: false, noScaleCache: true, selectable: false, evented: false,
    });

    const base = mk();
    const shadow = mk();
    const highlight = mk();

    // conservar metadata para re-vectorizar
    base._vecSourceEl = baseObj._vecSourceEl || element;
    base._vecMeta = baseObj._vecMeta;

    const group = new fabric.Group([shadow, highlight, base], {
      originX: 'center', originY: 'center',
      left: baseObj.left ?? 0, top: baseObj.top ?? 0,
      scaleX: baseObj.scaleX ?? 1, scaleY: baseObj.scaleY ?? 1,
      angle: baseObj.angle || 0,
      objectCaching: false, selectable: true, evented: true,
      subTargetCheck: false
    });
    group._kind = 'imgGroup';
    group._imgChildren = { base, shadow, highlight };
    group._debossOffset = offset;

    shadow.set({ globalCompositeOperation: 'multiply', opacity: 1 });
    highlight.set({ globalCompositeOperation: 'screen', opacity: 1 });

    const sync = () => {
      const sx = Math.max(1e-6, Math.abs(group.scaleX || 1));
      const sy = Math.max(1e-6, Math.abs(group.scaleY || 1));
      const ox = group._debossOffset / sx;
      const oy = group._debossOffset / sy;
      shadow.set({ left: -ox, top: -oy });
      highlight.set({ left: +ox, top: +oy });
      base.set({ left: 0, top: 0 });
      group.setCoords?.();
      c.requestRenderAll?.();
    };
    group._debossSync = sync;
    group.on('scaling', sync);
    group.on('modified', sync);
    sync();
    return group;
  };

  const updateDebossVisual = (obj, { offset }) => {
    if (!obj || obj._kind !== 'imgGroup' || !obj._imgChildren) return;
    obj._debossOffset = offset;
    obj._debossSync && obj._debossSync();
  };

 // ===== Relieve Texto (grupo sincronizado) =====
const makeTextGroup = (text, opts = {}) => {
  const base = new fabric.Textbox(text, {
    ...opts,
    originX: 'center', originY: 'center',
    left: 0, top: 0,
    selectable: false, evented: false,
    objectCaching: false, shadow: null, stroke: null,
    fill: 'rgba(35,35,35,1)', globalCompositeOperation: 'multiply'
  });
  const shadow = new fabric.Textbox(text, {
    ...opts,
    originX: 'center', originY: 'center',
    left: 0, top: 0,
    selectable: false, evented: false,
    objectCaching: false, fill: '',
    stroke: 'rgba(0,0,0,0.48)', strokeWidth: 1,
    globalCompositeOperation: 'multiply'
  });
  const highlight = new fabric.Textbox(text, {
    ...opts,
    originX: 'center', originY: 'center',
    left: 0, top: 0,
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

    // clona propiedades del "base" y aplica offset inverso a la escala
    const copyProps = o => {
      o.set({
        width: base.width,
        text: base.text,
        fontFamily: base.fontFamily,
        fontSize: base.fontSize,
        fontWeight: base.fontWeight,
        fontStyle: base.fontStyle,
        underline: base.underline,
        textAlign: base.textAlign,
        charSpacing: base.charSpacing
      });
    };
    copyProps(shadow);
    copyProps(highlight);

    base.set({ left: 0, top: 0 });
    shadow.set({ left: -ox, top: -oy });
    highlight.set({ left: +ox, top: +oy });

    group.setCoords();
    group.canvas?.requestRenderAll?.();
  };
  group._debossSync = sync;

  // sincroniza en todas las transformaciones relevantes
  ['moving','scaling','rotating','skewing','modified','changed'].forEach(ev => group.on(ev, sync));

  sync();
  return group;
};


  // ===== Acciones =====
  const addText = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    const group = makeTextGroup('Nuevo párrafo', {
      left: baseSize.w / 2, top: baseSize.h / 2,
      width: Math.min(baseSize.w * 0.9, 220),
      fontSize, fontFamily, fontWeight: isBold ? '700' : 'normal',
      fontStyle: isItalic ? 'italic' : 'normal',
      underline: isUnderline, textAlign
    });
    c.add(group);
    c.setActiveObject(group);
    setSelType('text');
    c.requestRenderAll();
    setEditing(true);
  };

  const addImageFromFile = (file) => {
    const c = fabricCanvasRef.current; if (!c || !file) return;
    const url = URL.createObjectURL(file);
    const imgEl = new Image(); imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => {
      const src = downscale(imgEl);
      const baseImg = vectorizeElementToBitmap(src, {
        maxDim: VECTOR_SAMPLE_DIM, makeDark: !vecInvert, drawColor: [51,51,51], thrBias: vecBias
      });
      if (!baseImg) { URL.revokeObjectURL(url); return; }
      const maxW = c.getWidth() * 0.8, maxH = c.getHeight() * 0.8;
      const s = Math.min(maxW / baseImg._vecMeta.w, maxH / baseImg._vecMeta.h);
      baseImg.set({
        originX: 'center', originY: 'center',
        left: c.getWidth()/2, top: c.getHeight()/2,
        scaleX: s, scaleY: s, selectable: false, evented: false, objectCaching: false
      });
      const group = attachDebossToBase(c, baseImg, { offset: vecOffset });
      c.add(group);
      c.setActiveObject(group);
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
      const pose = {
        left: active.left, top: active.top, originX: active.originX, originY: active.originY,
        scaleX: active.scaleX, scaleY: active.scaleY, angle: active.angle || 0
      };
      try { c.remove(active); } catch {}

      const baseImg = vectorizeElementToBitmap(src, {
        maxDim: VECTOR_SAMPLE_DIM, makeDark: !vecInvert, drawColor: [51,51,51], thrBias: vecBias
      });
      if (!baseImg) { URL.revokeObjectURL(url); return; }
      baseImg.set({ selectable: false, evented: false, objectCaching: false });

      const group = attachDebossToBase(c, baseImg, { offset: vecOffset });
      group.set(pose);
      c.add(group);
      c.setActiveObject(group);
      setSelType('image');
      c.requestRenderAll();
      setEditing(true);
      URL.revokeObjectURL(url);
    };
    imgEl.onerror = () => URL.revokeObjectURL(url);
    imgEl.src = url;
  };

  // ===== Borrado =====
  const onDelete = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;

    const removeOne = (o) => { try { c.remove(o); } catch {} };

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
  };

  // ===== Utils imagen =====
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

  // Otsu
  const otsuThreshold = (gray, total) => {
    if (!gray || !total || total <= 0) return 127;
    const hist = new Uint32Array(256);
    for (let i = 0; i < total; i++) hist[gray[i]]++;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, wB = 0, varMax = -1, threshold = 127;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (wB === 0) continue;
      const wF = total - wB; if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const diff = mB - mF;
      const between = wB * wF * diff * diff;
      if (Number.isFinite(between) && between > varMax) { varMax = between; threshold = t; }
    }
    return threshold;
  };

  const vectorizeElementToBitmap = (element, opts = {}) => {
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

    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
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
    const thr = clamp(thr0 + thrBias, 0, 255);

    for (let j = 0, i = 0; j < total; j++, i += 4) {
      const keep = makeDark ? (gray[j] <= thr) : (gray[j] > thr);
      if (keep) {
        data[i] = drawColor[0]; data[i+1] = drawColor[1]; data[i+2] = drawColor[2]; data[i+3] = 255;
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

  // ===== Aplicar a selección (Texto agrupado) =====
  const applyToSelection = (mutator) => {
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;

    const applyOne = (obj) => {
      if (obj?._kind === 'textGroup' && obj._textChildren?.base) {
        const { base, shadow, highlight } = obj._textChildren;
        mutator(base);
        // sincronizar clones
        const props = ['text','fontFamily','fontSize','fontWeight','fontStyle','underline','textAlign','charSpacing','width'];
        props.forEach(p => { shadow.set(p, base[p]); highlight.set(p, base[p]); });
        obj._debossSync && obj._debossSync();
        obj.setCoords();
      } else if (obj && (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text')) {
        mutator(obj); obj.setCoords();
      }
    };

    if (a.type === 'activeSelection' && Array.isArray(a._objects)) a._objects.forEach(applyOne);
    else applyOne(a);

    c.requestRenderAll();
  };

  // ===== Re-vectorización automática por Detalles/Invertir =====
  useEffect(() => {
    if (!editing || selType !== 'image') return;
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;

    const rebuild = (obj) => {
      let element = null, pose = null;
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

      const baseImg = vectorizeElementToBitmap(element, {
        maxDim: VECTOR_SAMPLE_DIM, makeDark: !vecInvert, drawColor: [51, 51, 51], thrBias: vecBias
      });
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
  }, [vecBias, vecInvert]); // mantiene selección tras re-vectorizar

  // ===== Offset del relieve en caliente =====
  useEffect(() => {
    if (!editing || selType !== 'image') return;
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;
    const upd = (obj) => { updateDebossVisual(obj, { offset: vecOffset }); };
    if (a.type === 'activeSelection' && a._objects?.length) a._objects.forEach(upd); else upd(a);
  }, [vecOffset, editing, selType]);

  // ===== Interactividad Fabric según editing =====
  useEffect(() => {
    const c = fabricCanvasRef.current;
    if (!c) return;

    const enableNode = (o, on) => {
      if (!o) return;
      const isGrouped = o._kind === 'imgGroup' || o._kind === 'textGroup';
      o.selectable = on;
      o.evented = on;
      o.lockMovementX = !on;
      o.lockMovementY = !on;
      o.hasControls = on;
      o.hasBorders = on;
      if (!isGrouped && (o.type === 'i-text' || typeof o.enterEditing === 'function')) o.editable = on;
      o.hoverCursor = on ? 'move' : 'default';
      if (isGrouped) return;
      const children = o._objects || (typeof o.getObjects === 'function' ? o.getObjects() : null);
      if (Array.isArray(children)) children.forEach(ch => enableNode(ch, on));
    };

    const setAll = (on) => {
      c.skipTargetFind = !on;
      c.selection = on;
      (c.getObjects?.() || []).forEach(o => enableNode(o, on));
      const upper = c.upperCanvasEl;
      const lower = c.lowerCanvasEl;
      if (upper) { upper.style.pointerEvents = on ? 'auto' : 'none'; upper.style.touchAction = on ? 'none' : 'auto'; }
      if (lower) { lower.style.pointerEvents = 'none'; lower.style.touchAction = 'none'; }
      c.defaultCursor = on ? 'move' : 'default';
      try { c.discardActiveObject(); } catch {}
      c.calcOffset?.();
      c.requestRenderAll?.();
      setTimeout(() => { c.calcOffset?.(); c.requestRenderAll?.(); }, 0);
    };

    setAll(!!editing);
  }, [editing]);

  // Heredar estado al añadir objetos
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

  // Aviso de modo
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('dobo-editing', { detail: { editing } }));
  }, [editing]);

  // ===== Zoom SIEMPRE activo (PC + móvil) =====
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

    // PC: rueda
    const onWheel = (e) => {
      e.preventDefault();
      writeZ(readZ() + (e.deltaY > 0 ? -0.08 : 0.08));
    };

    // Móvil: pinch 2 dedos (sin capturar 1 dedo)
    let pA=null, pB=null, startDist=0, startScale=1, parked=false, saved=null, unparkTimer=null;
    const armUnpark = () => { clearTimeout(unparkTimer); unparkTimer = setTimeout(() => { pA=pB=null; startDist=0; startScale=1; unpark(); }, 700); };

    const park = () => {
      if (parked || !c) return;
      saved = { selection: c.selection, skip: c.skipTargetFind };
      c.selection = false;
      c.skipTargetFind = true;
      parked = true;
    };
    const unpark = () => {
      clearTimeout(unparkTimer);
      if (!c) return;
      if (saved) { c.selection = saved.selection; c.skipTargetFind = saved.skip; saved=null; }
      parked = false;
      c.requestRenderAll?.();
    };

    const onPD = (e) => {
      if (e.pointerType !== 'touch') return;
      if (!pA) { pA = { id:e.pointerId, x:e.clientX, y:e.clientY }; return; }
      if (!pB && e.pointerId !== pA.id) {
        pB = { id:e.pointerId, x:e.clientX, y:e.clientY };
        startDist = Math.hypot(pA.x-pB.x, pA.y-pB.y);
        startScale = readZ();
        park();
      }
    };
    const onPM = (e) => {
      if (e.pointerType !== 'touch') return;
      if (pA && e.pointerId === pA.id) { pA.x = e.clientX; pA.y = e.clientY; }
      if (pB && e.pointerId === pB.id) { pB.x = e.clientX; pB.y = e.clientY; }
      if (pA && pB && startDist) {
        e.preventDefault();
        const d = Math.hypot(pA.x-pB.x, pA.y-pB.y);
        writeZ(startScale * Math.pow(d/startDist, 0.9));
        armUnpark();
      }
    };
    const onPU = (e) => {
      if (e.pointerType !== 'touch') return;
      if (pA && e.pointerId === pA.id) pA=null;
      if (pB && e.pointerId === pB.id) pB=null;
      if (!(pA && pB)) { startDist=0; startScale=1; unpark(); }
      clearTimeout(unparkTimer);
    };
    const onCancel = () => { pA=pB=null; startDist=0; startScale=1; unpark(); clearTimeout(unparkTimer); };

    target.addEventListener('wheel', onWheel, { passive:false, capture:true });
    target.addEventListener('pointerdown', onPD, { passive:true, capture:true });
    target.addEventListener('pointermove', onPM, { passive:false, capture:true });
    window.addEventListener('pointerup', onPU, { passive:true });
    window.addEventListener('pointercancel', onCancel, { passive:true });
    document.addEventListener('visibilitychange', onCancel);
    window.addEventListener('blur', onCancel);

    return () => {
      target.removeEventListener('wheel', onWheel, { passive:false, capture:true });
      target.removeEventListener('pointerdown', onPD, { passive:true, capture:true });
      target.removeEventListener('pointermove', onPM, { passive:false, capture:true });
      window.removeEventListener('pointerup', onPU);
      window.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('visibilitychange', onCancel);
      window.removeEventListener('blur', onCancel);
    };
  }, [stageRef, setZoom]);

  // Bloquear clicks fuera del overlay mientras editas (no afecta carruseles fuera de edición)
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
    const evs = ['pointerdown','mousedown','touchstart','click'];
    evs.forEach(ev => host.addEventListener(ev, stop, opts));

    return () => { evs.forEach(ev => host.removeEventListener(ev, stop, opts)); };
  }, [editing, anchorRef, stageRef]);

  if (!visible) return null;

  // ===== Overlay Canvas =====
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

  // ===== Menú =====
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
            onClick={() => { suppressSelectionRef.current = true; setEditing(false); setTimeout(()=>{suppressSelectionRef.current=false;},150); }}
            style={{ minWidth: '16ch' }}
          >
            Seleccionar Maceta
          </button>

          <button
            type="button"
            className={`btn ${editing ? 'btn-dark' : 'btn-outline-secondary'} text-nowrap`}
            onMouseDown={(e)=>e.preventDefault()}
            onClick={() => { suppressSelectionRef.current = true; setEditing(true); setTimeout(()=>{suppressSelectionRef.current=false;},150); }}
            style={{ minWidth: '12ch' }}
          >
            Diseñar
          </button>
        </div>

        {/* LÍNEA 2: Acciones */}
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

        {/* LÍNEA 3: Propiedades */}
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
      {stageRef?.current ? createPortal(OverlayCanvas, stageRef.current) : null}

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
