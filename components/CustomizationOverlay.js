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

const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

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

  // ===== Helpers de imagen =====
  function toImageData(img, targetW, targetH) {
    const canvas = document.createElement('canvas');
    canvas.width = targetW; canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return ctx.getImageData(0, 0, targetW, targetH);
  }

  function rgbToGray(data) {
    const { data: d, width, height } = data;
    const out = new Uint8ClampedArray(width * height);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      out[j] = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }
    return { data: out, width, height };
  }

  function normalizeGray(gray, { invert = false, bias = 0 } = {}) {
    const out = new Uint8ClampedArray(gray.data.length);
    for (let i = 0; i < gray.data.length; i++) {
      let v = gray.data[i] / 255;
      v = invert ? 1 - v : v;
      v = clamp(v + bias, 0, 1);
      out[i] = Math.round(v * 255);
    }
    return { data: out, width: gray.width, height: gray.height };
  }

  function toFabricTextureFromGray(gray) {
    const canvas = document.createElement('canvas');
    canvas.width = gray.width; canvas.height = gray.height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(gray.width, gray.height);
    for (let i = 0, j = 0; i < imgData.data.length; i += 4, j++) {
      const v = gray.data[j];
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  // ===== Medición del ancla y stage =====
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
    window.addEventListener('resize', measure, { passive: true });

    return () => {
      try { roA.disconnect(); } catch {}
      try { roS.disconnect(); } catch {}
      window.removeEventListener('resize', measure);
    };
  }, [stageRef, anchorRef]);

  // ===== Setup Fabric =====
  const historyRef = useRef(new HistoryManager());

  useEffect(() => {
    if (!visible) return;
    const el = canvasRef.current;
    if (!el) return;

    const c = new fabric.Canvas(el, {
      preserveObjectStacking: true,
      fireRightClick: false,
      stopContextMenu: true,
      selection: true,
    });
    fabricCanvasRef.current = c;

    // Base invisible sobre la que "pegamos" diseño
    const baseRect = new fabric.Rect({
      left: 0, top: 0, width: baseSize.w, height: baseSize.h,
      fill: 'rgba(0,0,0,0)', selectable: false, evented: false
    });
    baseRect._kind = 'baseRect';
    c.add(baseRect);

    // Selección
    const onSel = () => {
      const a = c.getActiveObject();
      if (!a) { setSelType('none'); return; }
      if (a._kind === 'textGroup' || a.type === 'textbox' || a.type === 'i-text') setSelType('text');
      else if (a._kind === 'imageGroup' || a.type === 'image') setSelType('image');
      else setSelType('none');
    };
    c.on('selection:created', onSel);
    c.on('selection:updated', onSel);
    c.on('selection:cleared', () => setSelType('none'));

    c.on('object:modified', () => {
      const snap = exportDesignSnapshot();
      if (snap) historyRef.current.push(snap);
    });

    // Doble-click para editar texto
    c.on('mouse:dblclick', (e) => {
      const ev = e?.e; ev?.stopPropagation?.(); ev?.preventDefault?.();
      let t = e.target;
      if (!t) return;
      if (t._kind !== 'textGroup' && t.group && t.group._kind === 'textGroup') t = t.group;
      if (t._kind === 'textGroup') {
        startInlineTextEdit(t);
      } else if ((t.type === 'i-text' || t.type === 'textbox') && typeof t.enterEditing === 'function') {
        t.enterEditing();
        c.requestRenderAll?.();
        try { t.hiddenTextarea?.focus(); } catch {}
      }
    });

    // Fallback por detail>=2 (algunas builds)
    c.on('mouse:up', (e) => {
     if (textEditing) return;
      const ev = e?.e;
      const isMouse = ev && (ev.pointerType === undefined || ev.pointerType === 'mouse');
      if (!isMouse || (ev.detail || 0) < 2) return;
      let t = e.target || c.findTarget?.(ev, false);
      if (t && t._kind !== 'textGroup' && t.group && t.group._kind === 'textGroup') t = t.group;
      if (t && t._kind === 'textGroup') { ev.preventDefault(); ev.stopPropagation(); startInlineTextEdit(t); }
      else if (t && (t.type === 'i-text' || t.type === 'textbox') && typeof t.enterEditing === 'function') {
        ev.preventDefault(); ev.stopPropagation(); t.enterEditing?.(); c.requestRenderAll?.(); try { t.hiddenTextarea?.focus(); } catch {}
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
    const snap = loadSessionDesign(productHandle);
    if (snap) importDesignSnapshot(snap);
  }, [ready, productHandle]);

  // ===== Text inline edit =====
  function startInlineTextEdit(group) {
    const c = fabricCanvasRef.current; if (!c) return;
    const text = group._text;
    setTextEditing(true);
    text.enterEditing?.();
    c.requestRenderAll?.();
    try { text.hiddenTextarea?.focus(); } catch {}
  }

  // ===== Crear TextGroup con sombra y luz =====
  function createTextGroup(text, opts) {
    const c = fabricCanvasRef.current; if (!c) return null;
    const base = new fabric.Textbox(text, {
      ...opts, originX: 'center', originY: 'center',
      left: 0, top: 0,
      fill: 'rgba(35,35,35,1)',
      stroke: null, strokeWidth: 0,
      objectCaching: false,
      fontFamily, fontSize,
      fontWeight: isBold ? '700' : '400',
      fontStyle: isItalic ? 'italic' : 'normal',
      underline: isUnderline, textAlign,
    });
    const shadow = new fabric.Textbox(text, {
      ...opts, originX: 'center', originY: 'center',
      left: -1, top: -1,
      selectable: false, evented: false,
      objectCaching: false, fill: '',
      stroke: 'rgba(0,0,0,0.48)', strokeWidth: 1
    });
    const highlight = new fabric.Textbox(text, {
      ...opts, originX: 'center', originY: 'center',
      left: +1, top: +1,
      selectable: false, evented: false,
      objectCaching: false, fill: '',
      stroke: 'rgba(255,255,255,0.32)', strokeWidth: 1
    });

    const group = new fabric.Group([shadow, highlight, base], {
      left: baseSize.w / 2,
      top: baseSize.h / 2,
      originX: 'center', originY: 'center',
      subTargetCheck: true,
    });
    group._kind = 'textGroup';
    group._text = base;
    return group;
  }

  // ===== Deboss a partir de imagen en escala de grises =====
  function buildDebossFromImage(img, { sampleW = VECTOR_SAMPLE_DIM, invert = vecInvert, bias = vecBias } = {}) {
    const scale = Math.min(MAX_TEXTURE_DIM / img.width, MAX_TEXTURE_DIM / img.height, 1);
    const tw = Math.round(img.width * scale);
    const th = Math.round(img.height * scale);
    const gray = normalizeGray(rgbToGray(toImageData(img, tw, th)), { invert, bias });
    return toFabricTextureFromGray(gray);
  }

  function attachDebossToBase(c, baseImg, { offset = vecOffset } = {}) {
    const tex = buildDebossFromImage(baseImg);
    const deboss = new fabric.Image(tex, {
      selectable: false, evented: false, objectCaching: false,
      left: 0, top: 0, originX: 'left', originY: 'top'
    });
    const s = Math.min(baseSize.w / deboss.width, baseSize.h / deboss.height);
    deboss.set({ scaleX: s, scaleY: s });

    const group = new fabric.Group([deboss], {
      left: baseSize.w / 2,
      top: baseSize.h / 2,
      originX: 'center', originY: 'center',
      subTargetCheck: true,
    });
    group._kind = 'imageGroup';
    group._image = baseImg;

    // Pequeño desplazamiento como relieve
    deboss.set({ left: -offset, top: -offset });
    return group;
  }

  function updateDebossVisual(obj, { offset = vecOffset } = {}) {
    if (!obj) return;
    if (obj._kind === 'imageGroup') {
      const deboss = obj._objects?.[0];
      if (deboss) deboss.set({ left: -offset, top: -offset });
    }
  }

  // ===== Export / Import snapshot =====
  function exportDesignSnapshot() {
    const c = fabricCanvasRef.current; if (!c) return null;
    const objs = c.getObjects();
    const payload = objs.map(o => {
      if (o._kind === 'textGroup') {
        return {
          k: 't',
          t: o._text?.text || '',
          x: o.left, y: o.top, sx: o.scaleX, sy: o.scaleY, a: o.angle || 0,
          ff: o._text?.fontFamily, fs: o._text?.fontSize, fw: o._text?.fontWeight, fi: o._text?.fontStyle,
          ul: o._text?.underline, ta: o._text?.textAlign,
        };
      } else if (o._kind === 'imageGroup') {
        return {
          k: 'i',
          x: o.left, y: o.top, sx: o.scaleX, sy: o.scaleY, a: o.angle || 0,
          // En esta versión simple solo guardamos pose. Imagen original se vuelve a pedir del store si aplica
        };
      }
      return null;
    }).filter(Boolean);
    return { version: 1, w: baseSize.w, h: baseSize.h, items: payload };
  }

  function importDesignSnapshot(snap) {
    const c = fabricCanvasRef.current; if (!c || !snap) return;
    c.clear();
    const baseRect = new fabric.Rect({ left: 0, top: 0, width: baseSize.w, height: baseSize.h, fill: 'rgba(0,0,0,0)', selectable: false, evented: false });
    baseRect._kind = 'baseRect';
    c.add(baseRect);

    (snap.items || []).forEach(it => {
      if (it.k === 't') {
        const g = createTextGroup(it.t, {});
        if (g) { g.set({ left: it.x, top: it.y, scaleX: it.sx, scaleY: it.sy, angle: it.a }); c.add(g); }
      } else if (it.k === 'i') {
        // Placeholder de imagen. En apps reales deberías rehidratar desde storage
        const dummy = document.createElement('canvas'); dummy.width = 32; dummy.height = 32;
        const g = attachDebossToBase(c, dummy, {});
        if (g) { g.set({ left: it.x, top: it.y, scaleX: it.sx, scaleY: it.sy, angle: it.a }); c.add(g); }
      }
    });
    c.requestRenderAll?.();
  }

  // ===== Acciones =====
  const addText = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    const opts = { fontFamily, fontSize, fontWeight: isBold ? '700' : '400', fontStyle: isItalic ? 'italic' : 'normal', underline: isUnderline, textAlign };
    const group = createTextGroup('Texto', opts);
    if (!group) return;
    group.set({ left: baseSize.w / 2, top: baseSize.h / 2, originX: 'center', originY: 'center' });
    c.add(group); c.setActiveObject(group); group.bringToFront?.();
    setSelType('text'); c.requestRenderAll?.(); setEditing(true); forceRepaint();
    const snap = exportDesignSnapshot(); if (snap) historyRef.current.push(snap);
  };

  const addImageFromFile = (file) => {
    const c = fabricCanvasRef.current; if (!c || !file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const baseImg = img;
        const s = Math.min(baseSize.w / img.width, baseSize.h / img.height);
        const tex = buildDebossFromImage(baseImg);
        const deboss = new fabric.Image(tex, { left: 0, top: 0, originX: 'left', originY: 'top', selectable: false, evented: false, objectCaching: false });
        const group = new fabric.Group([deboss], { left: baseSize.w / 2, top: baseSize.h / 2, originX: 'center', originY: 'center' });
        group._kind = 'imageGroup'; group._image = baseImg;
        group.set({ scaleX: s, scaleY: s, selectable: false, evented: false, objectCaching: false });
        const g2 = attachDebossToBase(c, baseImg, { offset: vecOffset });
        c.add(g2); c.setActiveObject(g2); group.bringToFront?.();
        setSelType('image'); c.requestRenderAll?.(); setEditing(true); forceRepaint();
        const snap = exportDesignSnapshot(); if (snap) historyRef.current.push(snap);
        URL.revokeObjectURL?.(reader.result);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const replaceActiveFromFile = (file) => {
    const c = fabricCanvasRef.current; if (!c || !file) return;
    const a = c.getActiveObject(); if (!a) return;
    const pose = { left: a.left, top: a.top, scaleX: a.scaleX, scaleY: a.scaleY, angle: a.angle };
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const baseImg = img;
        const s = Math.min(baseSize.w / img.width, baseSize.h / img.height);
        const tex = buildDebossFromImage(baseImg);
        const deboss = new fabric.Image(tex, { left: 0, top: 0, originX: 'left', originY: 'top', selectable: false, evented: false, objectCaching: false });
        const group = new fabric.Group([deboss], { left: baseSize.w / 2, top: baseSize.h / 2, originX: 'center', originY: 'center' });
        group._kind = 'imageGroup'; group._image = baseImg;
        group.set({ scaleX: s, scaleY: s, selectable: false, evented: false, objectCaching: false });
        const g2 = attachDebossToBase(c, baseImg, { offset: vecOffset });
        g2.set(pose);
        c.add(g2); c.setActiveObject(g2); group.bringToFront?.();
        setSelType('image'); c.requestRenderAll?.(); setEditing(true); forceRepaint();
        const snap = exportDesignSnapshot(); if (snap) historyRef.current.push(snap);
        URL.revokeObjectURL?.(reader.result);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const removeActive = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;
    if (a._kind === 'textGroup' || a._kind === 'imageGroup') {
      c.remove(a); c.discardActiveObject(); c.requestRenderAll?.();
      const snap = exportDesignSnapshot(); if (snap) historyRef.current.push(snap);
    }
  };

  const bringToFront = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;
    if (a.bringToFront) { a.bringToFront(); c.requestRenderAll?.(); }
  };

  const sendToBack = () => {
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;
    if (a.sendToBack) { a.sendToBack(); c.requestRenderAll?.(); }
  };

  // ===== Vectorización simple =====
  useEffect(() => {
    if (!editing) return;
    const c = fabricCanvasRef.current; if (!c) return;
    const a = c.getActiveObject(); if (!a) return;
    const upd = (obj) => updateDebossVisual(obj, { offset: vecOffset });
    if (a.type === 'activeSelection' && a._objects?.length) a._objects.forEach(upd); else upd(a);
    const snap = exportDesignSnapshot(); if (snap) historyRef.current.push(snap);
  }, [vecOffset, editing, selType]);

  if (!visible) return null;

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
        pointerEvents: "auto",
        touchAction: "none",
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

  function Menu() {
    return (
      <div
        ref={menuRef}
        className="shadow-lg rounded-2xl p-3 bg-white border"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="d-flex flex-wrap gap-2 align-items-center">
          {/* Texto */}
          <button className="btn btn-sm btn-dark" onClick={() => addText()}>+ Texto</button>

          {/* Imagen */}
          <button className="btn btn-sm btn-outline-dark" onClick={() => addInputRef.current?.click?.()}>+ Imagen</button>
          <input
            ref={addInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) addImageFromFile(f); e.target.value=''; }}
            onPointerDown={(e)=>e.stopPropagation()}
            style={{ display: 'none' }}
          />

          {/* Reemplazar */}
          <button className="btn btn-sm btn-outline-secondary" onClick={() => replaceInputRef.current?.click?.()}>Reemplazar</button>
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceActiveFromFile(f); e.target.value=''; }}
            onPointerDown={(e)=>e.stopPropagation()}
            style={{ display: 'none' }}
          />

          {/* Orden */}
          <div className="btn-group btn-group-sm" role="group">
            <button className="btn btn-outline-secondary" onClick={bringToFront}>Frente</button>
            <button className="btn btn-outline-secondary" onClick={sendToBack}>Fondo</button>
          </div>

          {/* Tipografía */}
          <select className="form-select form-select-sm w-auto" value={fontFamily} onChange={(e)=>setFontFamily(e.target.value)}>
            {FONT_OPTIONS.map(f => <option key={f.name} value={f.css}>{f.name}</option>)}
          </select>
          <input
            type="number"
            className="form-control form-control-sm w-auto"
            min={8}
            max={300}
            value={fontSize}
            onChange={(e)=>setFontSize(parseInt(e.target.value||'0',10))}
          />

          {/* Alinear */}
          <div className="btn-group btn-group-sm" role="group">
            <button className="btn btn-outline-secondary" onClick={()=>setShowAlignMenu(!showAlignMenu)}>Alinear</button>
            {showAlignMenu && (
              <div className="btn-group-vertical position-absolute translate-middle-x" style={{ bottom: '110%' }}>
                <button className="btn btn-outline-secondary" onClick={()=>setTextAlign('left')}>⟸</button>
                <button className="btn btn-outline-secondary" onClick={()=>setTextAlign('center')}>⟂</button>
                <button className="btn btn-outline-secondary" onClick={()=>setTextAlign('right')}>⟹</button>
              </div>
            )}
          </div>

          {/* Estilo */}
          <div className="btn-group btn-group-sm" role="group">
            <button className={`btn ${isBold?'btn-dark':'btn-outline-secondary'}`} onClick={()=>setIsBold(v=>!v)}>B</button>
            <button className={`btn ${isItalic?'btn-dark':'btn-outline-secondary'}`} onClick={()=>setIsItalic(v=>!v)}>I</button>
            <button className={`btn ${isUnderline?'btn-dark':'btn-outline-secondary'}`} onClick={()=>setIsUnderline(v=>!v)}>U</button>
          </div>

          {/* Vector offset */}
          <label className="ms-2 small">Relieve</label>
          <input type="range" className="form-range w-auto" min={-5} max={5} step={1} value={vecOffset} onChange={(e)=>setVecOffset(parseInt(e.target.value,10))} />
        </div>
      </div>
    );
  }

  return (
    <>
      {(stageRef?.current) ? createPortal(OverlayCanvas, stageRef.current) : OverlayCanvas}
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
