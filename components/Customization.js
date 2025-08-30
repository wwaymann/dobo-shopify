// components/Customization.js
import React, { useEffect, useRef, useState } from 'react';

const Customization = () => {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);        // namespace fabric (normalizado)
  const fabricCanvasRef = useRef(null);  // instancia de fabric.Canvas
  const mountedRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    mountedRef.current = true;

    // Solo en cliente
    if (typeof window === 'undefined') return;

    (async () => {
      // Import dinámico + normalización del export (soporta distintas builds de fabric)
      const mod = await import('fabric');
      const f = mod.fabric || mod.default || mod;
      fabricRef.current = f;

      // Limpia si hay un canvas previo (HMR/StrictMode)
      if (fabricCanvasRef.current && !fabricCanvasRef.current.destroyed) {
        try { fabricCanvasRef.current.dispose(); } catch {}
        fabricCanvasRef.current = null;
      }

      if (!mountedRef.current || !canvasRef.current) return;

      const c = new f.Canvas(canvasRef.current, {
        width: 800,
        height: 600,
        preserveObjectStacking: true,
      });
      fabricCanvasRef.current = c;

      // Fondo visible sin tapar objetos
      c.set('backgroundColor', '#ffffff');
      c.renderAll();

      // Texto inicial
      const text = new f.IText('Personaliza tu maceta DOBO', {
        left: 100,
        top: 50,
        fontSize: 30,
        fill: '#333',
        editable: true,
        selectable: true,
      });
      c.add(text);

      // Doble clic para editar texto
      c.on('mouse:dblclick', (e) => {
        const target = e.target;
        if (target && target.type === 'i-text') {
          target.enterEditing();
          c.requestRenderAll();
        }
      });

      setReady(true);
      console.log('[Customization] Canvas listo');
    })();

    return () => {
      mountedRef.current = false;
      const c = fabricCanvasRef.current;
      if (c) {
        try { c.dispose(); } catch {}
        fabricCanvasRef.current = null;
      }
      fabricRef.current = null;
    };
  }, []);

  const addText = () => {
    const c = fabricCanvasRef.current;
    const f = fabricRef.current;
    if (!c || !f) return;
    const t = new f.IText('Nuevo texto editable', {
      left: 100,
      top: 150,
      fontSize: 30,
      fill: '#333',
      editable: true,
      selectable: true,
    });
    c.add(t);
    c.setActiveObject(t);
    c.requestRenderAll();
  };

  // Loader robusto: FileReader -> native Image() -> fabric.Image
  const addImage = (event) => {
  const c = fabricCanvasRef.current;
  const f = fabricRef.current;
  const file = event.target.files?.[0];
  if (!c || !f || !file) {
    console.warn('[Customization] No canvas/fabric o no archivo');
    return;
  }

  console.log('[Customization] Archivo recibido:', file);

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    console.log('[Customization] dataURL listo, length:', typeof dataUrl === 'string' ? dataUrl.length : 0);

    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => {
      console.log('[Customization] Imagen HTML cargada (native onload)', imgEl.naturalWidth, imgEl.naturalHeight);

      const img = new f.Image(imgEl, {
        left: 400,
        top: 300,
        originX: 'center',
        originY: 'center',
        selectable: true,
      });

      const maxW = 300, maxH = 300;
      const nw = imgEl.naturalWidth || img.width || maxW;
      const nh = imgEl.naturalHeight || img.height || maxH;
      const scale = Math.min(maxW / nw, maxH / nh) || 1;
      img.scale(scale);

      c.add(img);

      // Asegurar que quede arriba en stacks sin bringToFront:
      const topIndex = Math.max(0, c.getObjects().length - 1);
      if (typeof img.moveTo === 'function') {
        img.moveTo(topIndex);
      } else if (typeof c.moveTo === 'function') {
        c.moveTo(img, topIndex);
      }

      c.setActiveObject(img);
      c.renderAll();

      console.log('[Customization] Imagen añadida (native loader OK)');
    };
    imgEl.onerror = (e) => {
      console.error('[Customization] Error en native Image.onload:', e);
    };
    imgEl.src = dataUrl;
  };
  reader.onerror = (e) => console.error('[Customization] FileReader error:', e);
  reader.readAsDataURL(file);
};

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={addText} disabled={!ready}>Agregar Texto</button>
        <input
          type="file"
          accept="image/*"
          onChange={addImage}
          disabled={!ready}
          style={{ marginLeft: 10 }}
        />
      </div>

      {/* Importante: width/height en el elemento <canvas> */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ border: '1px solid black', display: 'inline-block' }}
      />
    </div>
  );
};

export default Customization;
