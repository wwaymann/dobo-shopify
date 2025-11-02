import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

function CustomizationOverlay({
  stageRef,
  anchorRef,
  ready,
  editing,
  selType,
  fontFamily,
  fontSize,
  textAlign,
  isBold,
  isItalic,
  isUnderline,
  vecBias,
  vecOffset,
  vecInvert,
  shapeColor,
  setShapeColor,
  setFontFamily,
  setFontSize,
  setTextAlign,
  setShowAlignMenu,
  setVecBias,
  setVecOffset,
  setVecInvert,
  applyToSelection,
  applyColorToActive,
  addText,
  addImageFromFile,
  addRgbImageFromFile,
  replaceActiveFromFile,
  setUploadMode,
  addInputRef,
  replaceInputRef,
  historyRef,
  applySnapshot,
  refreshCaps,
  histCaps,
  exitDesignMode,
  enterDesignMode,
  handleCameraCapture,
  onDelete,
}) {
  const FONT_OPTIONS = [
    { name: 'Arial', css: 'Arial, sans-serif' },
    { name: 'Georgia', css: 'Georgia, serif' },
    { name: 'Poppins', css: 'Poppins, sans-serif' },
  ];

  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

  const Menu = () => (
    <div className="dobo-menu">
      {/* LÍNEA 1: Zoom + modos */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="btn-group btn-group-sm" role="group" aria-label="Historial">
          <button type="button" className="btn btn-outline-secondary" onPointerDown={(e)=>e.stopPropagation()} onMouseDown={(e)=>e.preventDefault()} onClick={() => { const s = historyRef.current?.undo(); if (s) applySnapshot(s); refreshCaps(); }} disabled={!histCaps.canUndo}>←</button>
          <button type="button" className="btn btn-outline-secondary" onPointerDown={(e)=>e.stopPropagation()} onMouseDown={(e)=>e.preventDefault()} onClick={() => { const s = historyRef.current?.redo(); if (s) applySnapshot(s); refreshCaps(); }} disabled={!histCaps.canRedo}>→</button>
        </div>
        <button type="button" className={`btn ${!editing ? 'btn-dark' : 'btn-outline-secondary'}`} onClick={exitDesignMode}>Seleccionar Maceta</button>
        <button type="button" className={`btn ${editing ? 'btn-dark' : 'btn-outline-secondary'}`} onClick={enterDesignMode}>Diseñar</button>
      </div>

      {/* LÍNEA 2: Acciones básicas */}
      {editing && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addText} disabled={!ready}>+ Texto</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setUploadMode('vector'); addInputRef.current?.click(); }} disabled={!ready}>+ Imagen</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setUploadMode('rgb'); addInputRef.current?.click(); }} disabled={!ready}>+ Imagen (RGB)</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleCameraCapture} disabled={!ready} title="Abrir cámara">
            <i className="fas fa-camera"></i>
          </button>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDelete} disabled={!ready || selType === 'none'}>Borrar</button>
        </div>
      )}

      {/* LÍNEA 3: Propiedades por tipo */}
      {editing && (
        <>
          {selType === 'text' && (
            <>
              <div className="input-group input-group-sm" style={{ maxWidth: 150 }}>
                <span className="input-group-text">Color</span>
                <input type="color" className="form-control form-control-color" value={shapeColor} onChange={(e) => { setShapeColor(e.target.value); applyColorToActive(e.target.value); }} />
              </div>
              <div className="input-group input-group-sm" style={{ maxWidth: 220 }}>
                <span className="input-group-text">Fuente</span>
                <select className="form-select form-select-sm" value={fontFamily} onChange={(e) => { const v = e.target.value; setFontFamily(v); applyToSelection(o => o.set({ fontFamily: v })); }}>
                  {FONT_OPTIONS.map(f => <option key={f.name} value={f.css} style={{ fontFamily: f.css }}>{f.name}</option>)}
                </select>
              </div>
            </>
          )}
          {selType === 'image' && (
            <>
              <div className="input-group input-group-sm" style={{ width: 170 }}>
                <span className="input-group-text">Color</span>
                <input type="color" className="form-control form-control-color" value={shapeColor} onChange={(e)=>{ setShapeColor(e.target.value); applyColorToActive(e.target.value); }} />
              </div>
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
            </>
          )}
        </>
      )}

      {/* Inputs ocultos */}
      <input ref={addInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { (uploadMode === 'rgb' ? addRgbImageFromFile : addImageFromFile)(f); } e.target.value = ''; }} style={{ display: 'none' }} />
      <input ref={replaceInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceActiveFromFile(f); e.target.value = ''; }} style={{ display: 'none' }} />
    </div>
  );

  return (
    <>
      {stageRef?.current ? createPortal(<Menu />, stageRef.current) : null}
      {anchorRef?.current ? createPortal(
        <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', pointerEvents: 'none', marginTop: 8 }}>
          <div style={{ pointerEvents: 'auto', display: 'inline-flex' }}><Menu /></div>
        </div>,
        document.getElementById('dobo-menu-dock')
      ) : null}
    </>
  );
}

export default CustomizationOverlay;
