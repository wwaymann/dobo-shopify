// components/CustomizationOverlay.js
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { createPortal } from 'react-dom';
import HistoryManager from '../lib/history';
import { saveSessionDesign, loadSessionDesign } from '../lib/designStore';

// ===== Constantes =====
const MAX_TEXTURE_DIM = 1600;
const VECTOR_SAMPLE_DIM = 500;
const Z_CANVAS = 4000;
const Z_MENU = 10000;

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

export default function CustomizationOverlay({
  stageRef,
  anchorRef,
  visible = true,
  zoom = 1,
  setZoom,
  productHandle,
}) {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const overlayRef = useRef(null);

  const addInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const menuRef = useRef(null);

  const [baseSize, setBaseSize] = useState({ w: 1, h: 1 });
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [selType, setSelType] = useState('none');

  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].css);
  const [fontSize, setFontSize] = useState(60);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState('center');
  const [showAlignMenu, setShowAlignMenu] = useState(false);

  const [vecOffset, setVecOffset] = useState(1);
  const [vecInvert, setVecInvert] = useState(false);
  const [vecBias, setVecBias] = useState(0);

  const suppressSelectionRef = useRef(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const [overlayBox, setOverlayBox] = useState({ left: 0, top: 0, w: 1, h: 1 });
  const [textEditing, setTextEditing] = useState(false);

  const isApplyingRef = useRef(false);
  function forceRepaint() {
    const c = fabricCanvasRef.current; if (!c) return;
    try { (c.getObjects() || []).forEach(o => o.dirty = true); c.discardActiveObject(); } catch {}
    c.calcOffset?.(); c.renderAll?.(); c.requestRenderAll?.();
    setTimeout(() => { c.calcOffset?.(); c.requestRenderAll?.(); }, 0);
  }

  const historyRef = useRef(new HistoryManager({
    limit: 200,
    onChange: (current) => {
      if (!current || isApplyingRef.current) return;
      saveSessionDesign(productHandle, current);
    }
  }));

  useEffect(() => {
    const c = fabricCanvasRef.current;
    const upper = c?.upperCanvasEl;
    if (!upper) return;
    upper.style.touchAction = textEditing ? 'auto' : (editing ? 'none' : 'auto');
  }, [textEditing, editing]);

  useEffect(() => {
    const v = typeof zoom === 'number' ? zoom : 1;
    stageRef?.current?.style.setProperty('--zoom', String(v));
  }, [zoom, stageRef]);

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

  // === Relieve texto ===
  const makeTextGroup = (text, opts = {}) => {
    const base = new fabric.Textbox(text, {
      ...opts,
      originX: 'center', originY: 'center',
      selectable: false, evented: false,
      objectCaching: false, shadow: null, stroke: null,
      fill: 'rgba(35,35,35,1)'
    });
    const shadow = new fabric.Textbox(text, {
      ...opts,
      originX: 'center', originY: 'center',
      left: -1, top: -1,
      selectable: false, evented: false,
      objectCaching: false, fill: '',
      stroke: 'rgba(0,0,0,0.48)', strokeWidth: 1
    });
    const highlight = new fabric.Textbox(text, {
      ...opts,
      originX: 'center', originY: 'center',
      left: +1, top: +1,
      selectable: false, evented: false,
      objectCaching: false, fill: '',
      stroke: 'rgba(255,255,255,0.65)', strokeWidth: 0.6
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
    group.on('scaling', sync);
    group.on('modified', sync);
    sync();
    return group;
  };

  // === Relieve imagen ===
  const attachDebossToBase = (c, baseObj, { offset = 1 } = {}) => {
    const elFrom = () => {
      const el = typeof baseObj.getElement === 'function' ? baseObj.getElement() : baseObj._element;
      return new fabric.Image(el, {
        originX: 'center', originY: 'center',
        objectCaching: false, noScaleCache: true, selectable: false, evented: false,
      });
    };
    const base = elFrom();
    theShadowFix: {
      /* no-op label to make diff smaller */
    }
    const shadow = elFrom();
    const highlight = elFrom();

    const group = new fabric.Group([shadow, highlight, base], {
      originX: 'center', originY: 'center',
      objectCaching: false, selectable: true, evented: true,
      subTargetCheck: false,
    });
    group._kind = 'imgGroup';
    group._imgChildren = { base, shadow, highlight };
    group._debossOffset = offset;

    group.left = baseObj.left ?? 0;
    group.top = baseObj.top ?? 0;
    group.scaleX = baseObj.scaleX ?? 1;
    group.scaleY = baseObj.scaleY ?? 1;
    group.angle = baseObj.angle ?? 0;

    const srcEl = typeof baseObj.getElement === 'function' ? baseObj.getElement() : baseObj._element;
    const applyEl = (img) => { base.setElement(img); shadow.setElement(img); highlight.setElement(img); };
    applyEl(srcEl);

    const normalize = () => {
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
    group._debossSync = normalize;
    group.on('scaling', normalize);
    group.on('modified', normalize);
    normalize();

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
    g.setCoords(); g.canvas?.requestRenderAll?.();
  };

  // === Vectorizado ===
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
      const mB = sumB / wB; const mF = (sum - sumB) / wF; const diff = mB - mF;
      const between = wB * wF * diff * diff;
      if (Number.isFinite(between) && between > varMax) { varMax = between; threshold = t; }
    }
    return threshold;
  };

  const vectorizeElementToBitmap = (element, opts = {}) => {
    const { maxDim = VECTOR_SAMPLE_DIM, makeDark = true, drawColor = [51, 51, 51], thrBias = 0 } = opts;
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
    const data = img?.data; const total = w * h; if (!data || data.length < total * 4) return null;

    const gray = new Uint8Array(total);
    for (let i = 0, j = 0; j < total; i += 4, j++) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      gray[j] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
    const thr0 = otsuThreshold(gray, total);
    const thr = clamp(thr0 + thrBias, 0, 255);

    for (let j = 0, i = 0; j < total; j++, i += 4) {
      const keep = makeDark ? (gray[j] <= thr) : (gray[j] > thr);
      if (keep) { data[i] = drawColor[0]; data[i + 1] = drawColor[1]; data[i + 2] = drawColor[2]; data[i + 3] = 255; }
      else { data[i + 3] = 0; }
    }
    ctx.putImageData(img, 0, 0);

    const bm = new fabric.Image(cv, {
      left: 0, top: 0, originX: 'left', originY: 'top',
      objectCaching: false, noScaleCache: true, selectable: true, evented: true,
    });
    bm._vecSourceEl = element; bm._vecMeta = { w, h };
    return bm;
  };

  // === Init Fabric ===
  useEffect(() => {
    if (!visible || !canvasRef.current || fabricCanvasRef.current) return;

    const c = new fabric.Canvas(canvasRef.current, {
      width: 1, height: 1, preserveObjectStacking: true, selection: true,
      perPixelTargetFind: true, targetFindTolerance: 8,
    });
    fabricCanvasRef.current = c;
    c.renderOnAddRemove = true;

    if (typeof window !== 'undefined') {
      window.doboDesignAPI = {
        toPNG: (mult = 3) => c.toDataURL({ format: 'png', multiplier: mult, backgroundColor: 'transparent' }),
        toSVG: () => c.toSVG({ suppressPreamble: true }),
        getCanvas: () => c,
      };
    }

    const classify = (a) => {
      if (!a) return 'none';
      if (a._kind === 'imgGroup') return 'image';
      if (a._kind === 'textGroup') return 'text';
      if (a.type === 'activeSelection' && a._objects?.length) {
        if (a._objects.every(o => o._kind === 'textGroup')) return 'text';
        if (a._objects.some(o => o._kind === 'imgGroup')) return 'image';
        return 'none';
      }
      if (a.type === 'image') return 'image';
      if (a.type === 'i-text' || a.type === 'textbox' || a.type === 'text') return 'text';
      return 'none';
    };

    const isTextObj = (o) => o && (o.type === 'i-text' || o.type === 'textbox' || o.type === 'text');

    const reflectTypo = () => {
      const a = c.getActiveObject(); if (!a) return;
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

    c.on('object:modified', () => {
      const snap = exportDesignSnapshot();
      if (snap) historyRef.current.push(snap);
    });

    // Doble-click para editar texto (PC)
    c.on('mouse:dblclick', (e) => {
      let t = e.target;
      if (!t) return;
      if (t._kind !== 'textGroup' && t.group && t.group._kind === 'textGroup') t = t.group;
      if (t._kind === 'textGroup') {
        startInlineTextEdit(t);
      } else if ((t.type === 'i-text' || t.type === 'textbox') && typeof t.enterEditing === 'function') {
        t.enterEditing();
        c.requestRenderAll();
        try { t.hiddenTextarea?.focus(); } catch {}
      }
    });

    // Fallback por detail>=2
    c.on('mouse:up', (e) => {
      if (!editing || textEditing) return;
      const ev = e?.e;
      const isMouse = ev && (ev.pointerType === undefined || ev.pointerType === 'mouse');
      if (!isMouse || (ev.detail || 0) < 2) return;
      let t = e.target || c.findTarget?.(ev, false);
      if (t && t._kind !== 'textGroup' && t.group && t.group._kind === 'textGroup') t = t.group;
      if (t && t._kind === 'textGroup') { ev.preventDefault(); ev.stopPropagation(); startInlineTextEdit(t); }
      else if (t && (t.type === 'i-text' || t.type === 'textbox') && typeof t.enterEditing === 'function') {
        ev.preventDefault(); ev.stopPropagation(); t.enterEditing(); c.requestRenderAll(); try { t.hiddenTextarea?.focus(); } catch {}
      }
    });

    setReady(true);
    return () => {
      c.off('mouse:dblclick'); c.off('mouse:up');
      c.off('selection:created', onSel); c.off('selection:updated', onSel); c.off('selection:cleared');
      c.off('object:modified');
      try { c.dispose(); } catch {}
      fabricCanvasRef.current = null;
    };
  }, [visible, editing, textEditing]);

  useEffect(() => {
    if (!ready || !productHandle) return;
    const seed = loadSessionDesign(productHandle);
    if (seed) {
      applyDesignSnapshotToCanvas(seed);
      historyRef.current.replaceAll ? historyRef.current.replaceAll([seed]) : (historyRef.current.clear?.(), historyRef.current.push(seed));
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/design/load?handle=${encodeURIComponent(productHandle)}`);
        if (r.ok) {
          const data = await r.json();
          if (data?.snapshot) {
            applyDesignSnapshotToCanvas(data.snapshot);
            historyRef.current.replaceAll ? historyRef.current.replaceAll([data.snapshot]) : (historyRef.current.clear?.(), historyRef.current.push(data.snapshot));
          }
        }
      } catch {}
    })();
  }, [ready, productHandle]);

  function rehydrateTextGroups(c) {
    (c.getObjects() || []).forEach(g => {
      if (g?._kind === 'textGroup' && Array.isArray(g._objects) && g._objects.length >= 3) {
        g._textChildren = { shadow: g._objects[0], highlight: g._objects[1], base: g._objects[2] };
        g.subTargetCheck = false;
        g.selectable = true; g.evented = true; g.hasControls = true; g.hasBorders = true;
        g._objects.forEach(ch => { ch.selectable = false; ch.evented = false; ch.objectCaching = false; });
        const sync = () => {
          const sx = Math.max(1e-6, Math.abs(g.scaleX || 1));
          const sy = Math.max(1e-6, Math.abs(g.scaleY || 1));
          const ox = 1 / sx, oy = 1 / sy;
          g._textChildren.shadow?.set({ left: -ox, top: -oy });
          g._textChildren.highlight?.set({ left: +ox, top: +oy });
          g.setCoords(); g.canvas?.requestRenderAll?.();
        };
        g.off('scaling'); g.off('modified'); g.on('scaling', sync); g.on('modified', sync); sync();
      }
    });
  }

  function applyInteractivityForEditing(c, on) {
    const enableNode = (o, on) => {
      if (!o) return;
      const isGroup = o._kind === 'imgGroup' || o._kind === 'textGroup';
      o.selectable = on; o.evented = on; o.lockMovementX = !on; o.lockMovementY = !on;
      o.hasControls = on; o.hasBorders = on;
      if (!isGroup && (o.type === 'i-text' || typeof o.enterEditing === 'function')) o.editable = on;
      o.hoverCursor = on ? 'move' : 'default';
      const children = o._objects || (typeof o.getObjects === 'function' ? o.getObjects() : null);
      if (Array.isArray(children)) children.forEach(ch => enableNode(ch, on));
    };
    (c.getObjects?.() || []).forEach(o => enableNode(o, on));
    const upper = c.upperCanvasEl, lower = c.lowerCanvasEl;
    if (upper) { upper.style.pointerEvents = on ? 'auto' : 'none'; upper.style.touchAction = on ? 'none' : 'auto'; upper.tabIndex = on ? 0 : -1; }
    if (lower) { lower.style.pointerEvents = 'none'; lower.style.touchAction = 'none'; }
    c.defaultCursor = on ? 'move' : 'default';
  }

  useEffect(() => {
    const c = fabricCanvasRef.current; if (!c) return;
    c.setWidth(baseSize.w); c.setHeight(baseSize.h);
    c.calcOffset?.(); c.requestRenderAll?.();
  }, [baseSize.w, baseSize.h]);

  useEffect(() => {
    const c = fabricCanvasRef.current; if (!c) return;
    applyInteractivityForEditing(c, !!editing);
    try { c.discardActiveObject(); } catch {}
    c.calcOffset?.(); c.requestRenderAll?.();
    setTimeout(() => { c.calcOffset?.(); c.requestRenderAll?.(); }, 0);
  }, [editing]);

  useEffect(() => {
    const c = fabricCanvasRef.current; if (!c) return;
    const apply = (o) => {
      o.selectable = editing; o.evented = editing;
      o.lockMovementX = !editing; o.lockMovementY = !editing;
      if (o.type === 'i-text' || typeof o.enterEditing === 'function') o.editable = editing;
      o.hoverCursor = editing ? 'move' : 'default';
    };
    const onAdded = (e) => { if (e?.target) apply(e.target); };
    c.on('object:added', onAdded);
    return () => { c.off('object:added', onAdded); };
  }, [editing]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('dobo-editing', { detail: { editing } }));
  }, [editing]);

  // === Edición inline (PC doble-click) ===
  const startInlineTextEdit = (group) => {
    const c = fabricCanvasRef.current; if (!c || !group || group._kind !== 'textGroup') return;
    const base = group._textChildren?.base; if (!base) return;

    const pose = { left: group.left, top: group.top, originX: 'center', originY: 'center',
      scaleX: group.scaleX || 1, scaleY: group.scaleY || 1, angle: group.angle || 0 };

    try { c.remove(group); } catch {}

    const tb = new fabric.Textbox(base.text || 'Texto', {
      left: pose.left, top: pose.top, originX: 'center', originY: 'center',
      width: Math.min(baseSize.w * 0.9, base.width || 220),
      fontFamily: base.fontFamily, fontSize: base.fontSize, fontWeight: base.fontWeight,
      fontStyle: base.fontStyle, underline: base.underline, textAlign: base.textAlign,
      editable: true, selectable: true, evented: true, objectCaching: false
    });

    c.add(tb); c.setActiveObject(tb); c.requestRenderAll();
    setTextEditing(true);

    setTimeout(() => {
      try { tb.enterEditing?.(); } catch {}
      try { tb.hiddenTextarea?.focus(); } catch {}
      setTimeout(() => { try { tb.hiddenTextarea?.focus(); } catch {} }, 60);
    }, 0);

    const finish = () => {
      const newText = tb.text || '';
      const finalPose = { left: tb.left, top: tb.top, originX: tb.originX, originY: tb.originY,
        scaleX: tb.scaleX, scaleY: tb.scaleY, angle: tb.angle };
      try { c.remove(tb); } catch {}

      const group2 = makeTextGroup(newText, {
        width: tb.width,
        fontFamily: tb.fontFamily, fontSize: tb.fontSize, fontWeight: tb.fontWeight,
        fontStyle: tb.fontStyle, underline: tb.underline, textAlign: tb.textAlign,
      });
      group2.set(finalPose);
      c.add(group2); c.setActive
