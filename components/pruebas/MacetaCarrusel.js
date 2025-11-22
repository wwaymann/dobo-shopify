import { useEffect, useRef, useState } from "react";

export default function MacetaFinal() {
  const macetas = [
    "/maceta1.png",
    "/maceta2.png",
    "/maceta3.png",
    "/maceta4.png",
    "/maceta5.png",
    "/maceta6.png",
    "/maceta7.png",
    "/maceta8.png",
  ];

  const [index, setIndex] = useState(0);

  // Texto 1
  const [texto1, setTexto1] = useState("Texto 1");
  const [color1, setColor1] = useState("#000000");
  const [fontBase1, setFontBase1] = useState(60);
  const [textoY1, setTextoY1] = useState(300);

  // Texto 2
  const [texto2, setTexto2] = useState("Texto 2");
  const [color2, setColor2] = useState("#000000");
  const [fontBase2, setFontBase2] = useState(40);
  const [textoY2, setTextoY2] = useState(350);

  const [shape, setShape] = useState(null);

  const svgRef = useRef(null);

  // Drag control
  const draggingRef = useRef(null);
  const offsetRef = useRef(0);

  const CANVAS = 500;
  const SAMPLES = 40;

  // ---------------------------------------
  // LECTURA MEJORADA DE CURVAS
  // ---------------------------------------
  useEffect(() => {
    const img = new Image();
    img.src = macetas[index];
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const off = document.createElement("canvas");
      off.width = CANVAS;
      off.height = CANVAS;
      const ctx = off.getContext("2d");

      const maxW = CANVAS * 0.75;
      const w = maxW;
      const h = (img.height / img.width) * w;
      const x = (CANVAS - w) / 2;
      const y = (CANVAS - h) / 2;

      ctx.drawImage(img, x, y, w, h);

      const data = ctx.getImageData(0, 0, CANVAS, CANVAS).data;

      const topPoints = [];
      const bottomPointsRaw = [];

      const x0 = Math.round(CANVAS * 0.15);
      const x1 = Math.round(CANVAS * 0.85);

      for (let i = 0; i <= SAMPLES; i++) {
        const colX = Math.round(x0 + ((x1 - x0) * i) / SAMPLES);

        let topY = null;
        let bottomY = null;

        // detectar borde superior
        for (let yy = 0; yy < CANVAS; yy++) {
          if (data[(yy * CANVAS + colX) * 4 + 3] > 10) {
            topY = yy;
            break;
          }
        }

        // detectar borde inferior
        for (let yy = CANVAS - 1; yy >= 0; yy--) {
          if (data[(yy * CANVAS + colX) * 4 + 3] > 10) {
            bottomY = yy;
            break;
          }
        }

        if (topY != null && bottomY != null) {
          topPoints.push({ x: colX, y: topY });
          bottomPointsRaw.push({ x: colX, y: bottomY });
        }
      }

      // -----------------------------------------
      // BORDE INFERIOR OPTIMIZADO (no el real)
      // Tomamos SOLO una parte superior del cuerpo
      // para evitar zonas de estrechamiento.
      // -----------------------------------------
      const bottomPoints = bottomPointsRaw.map((p, i) => {
        const top = topPoints[i];
        const realBottom = p.y;
        const safeBottom = top.y + (realBottom - top.y) * 0.35; // límite seguro
        return { x: p.x, y: safeBottom };
      });

      const avgTop =
        topPoints.reduce((s, p) => s + p.y, 0) / topPoints.length;

      const avgBottom =
        bottomPoints.reduce((s, p) => s + p.y, 0) / bottomPoints.length;

      const yMin = avgTop + 5;
      const yMax = avgBottom - 5;

      setTextoY1((yMin + yMax) / 2);
      setTextoY2((yMin + yMax) / 2 + 40);

      setShape({
        topPoints,
        bottomPoints,
        yMin,
        yMax,
        imageRect: { x, y, w, h },
      });
    };
  }, [index]);

  // ---------------------------------------
  // DRAG UNIVERSAL (touch + mouse)
  // ---------------------------------------
  const startDrag = (textId, clientY) => {
    draggingRef.current = textId;
    const currentY = textId === 1 ? textoY1 : textoY2;
    offsetRef.current = clientY - currentY;
  };

  const moveDrag = (clientY) => {
    if (!shape || !draggingRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    let newY = clientY - rect.top - offsetRef.current;

    if (newY < shape.yMin) newY = shape.yMin;
    if (newY > shape.yMax) newY = shape.yMax;

    if (draggingRef.current === 1) setTextoY1(newY);
    if (draggingRef.current === 2) setTextoY2(newY);
  };

  useEffect(() => {
    const move = (e) => moveDrag(e.clientY);
    const moveTouch = (e) => {
      moveDrag(e.touches[0].clientY);
      e.preventDefault();
    };
    const end = () => (draggingRef.current = null);

    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", moveTouch, { passive: false });
    window.addEventListener("mouseup", end);
    window.addEventListener("touchend", end);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", moveTouch);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchend", end);
    };
  }, [shape]);

  if (!shape) return <p>Cargando…</p>;

  const { topPoints, bottomPoints, yMin, yMax, imageRect } = shape;

  // ---------------------------------------
  // FUNCIÓN PARA CREAR UN PATH SUAVE
  // ---------------------------------------
  const createPath = (t) => {
    const interp = topPoints.map((pTop, i) => {
      const pBottom = bottomPoints[i];

      return {
        x: pTop.x,
        y: pTop.y * (1 - t) + pBottom.y * t,
      };
    });

    let d = `M ${interp[0].x} ${interp[0].y}`;
    for (let i = 1; i < interp.length; i++) {
      d += ` L ${interp[i].x} ${interp[i].y}`;
    }
    return d;
  };

  const t1 = (textoY1 - yMin) / (yMax - yMin);
  const t2 = (textoY2 - yMin) / (yMax - yMin);

  const font1 = Math.min(fontBase1, 200) * (0.7 + 0.4 * (1 - t1));
  const font2 = Math.min(fontBase2, 200) * (0.7 + 0.4 * (1 - t2));

  const d1 = createPath(t1);
  const d2 = createPath(t2);

  return (
    <div style={{ width: "100%", maxWidth: 520, margin: "0 auto" }}>
      <h3>DOBO – Editor Optimizado</h3>

      {/* TEXTOS */}
      <label>Texto 1:</label>
      <input
        value={texto1}
        onChange={(e) => setTexto1(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <label>Color:</label>
      <input
        type="color"
        value={color1}
        onChange={(e) => setColor1(e.target.value)}
        style={{ width: 60, marginBottom: 20 }}
      />

      <label>Tamaño base (máx 200): {fontBase1}px</label>
      <input
        type="range"
        min={10}
        max={200}
        value={fontBase1}
        onChange={(e) => setFontBase1(Number(e.target.value))}
        style={{ width: "100%", marginBottom: 20 }}
      />

      <label>Texto 2:</label>
      <input
        value={texto2}
        onChange={(e) => setTexto2(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <label>Color:</label>
      <input
        type="color"
        value={color2}
        onChange={(e) => setColor2(e.target.value)}
        style={{ width: 60, marginBottom: 20 }}
      />

      <label>Tamaño base (máx 200): {fontBase2}px</label>
      <input
        type="range"
        min={10}
        max={200}
        value={fontBase2}
        onChange={(e) => setFontBase2(Number(e.target.value))}
        style={{ width: "100%", marginBottom: 20 }}
      />

      {/* CARRUSEL */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button onClick={() => setIndex((i) => (i === 0 ? 7 : i - 1))}>◀︎</button>
        <button onClick={() => setIndex((i) => (i + 1) % 8)}>▶︎</button>
      </div>

      {/* SVG PRINCIPAL */}
      <svg
        ref={svgRef}
        width={CANVAS}
        height={CANVAS}
        style={{ width: "100%", border: "1px solid #ccc", marginTop: 20 }}
      >
        <image
          href={macetas[index]}
          x={imageRect.x}
          y={imageRect.y}
          width={imageRect.w}
          height={imageRect.h}
        />

        {/* TEXT PATH 1 */}
        <path id="text1" d={d1} fill="none" />

        <text
          fill={color1}
          fontSize={font1}
          fontWeight="bold"
          textAnchor="middle"
          style={{ cursor: "grab" }}
          onMouseDown={(e) => startDrag(1, e.clientY)}
          onTouchStart={(e) => startDrag(1, e.touches[0].clientY)}
        >
          <textPath href="#text1" startOffset="50%">
            {texto1}
          </textPath>
        </text>

        {/* TEXT PATH 2 */}
        <path id="text2" d={d2} fill="none" />

        <text
          fill={color2}
          fontSize={font2}
          fontWeight="bold"
          textAnchor="middle"
          style={{ cursor: "grab" }}
          onMouseDown={(e) => startDrag(2, e.clientY)}
          onTouchStart={(e) => startDrag(2, e.touches[0].clientY)}
        >
          <textPath href="#text2" startOffset="50%">
            {texto2}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
