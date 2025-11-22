import { useEffect, useRef, useState } from "react";

export default function MacetaFinalResponsive() {
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
  const containerRef = useRef(null);

  const dragTarget = useRef(null);
  const offsetRef = useRef(0);

  const CANVAS = 500;
  const SAMPLES = 40;

  // RESPONSIVO: escalar según pantalla
  const [viewSize, setViewSize] = useState(500);

  useEffect(() => {
    const resize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.offsetWidth;
      setViewSize(Math.min(w, 500));
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ---------------------------------------
  // LECTURA DE BORDES SUPERIOR + “INFERIOR SEGURO”
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

      const x0 = CANVAS * 0.15;
      const x1 = CANVAS * 0.85;

      for (let i = 0; i <= SAMPLES; i++) {
        const colX = Math.round(x0 + ((x1 - x0) * i) / SAMPLES);

        let topY = null;
        let bottomY = null;

        for (let yy = 0; yy < CANVAS; yy++) {
          if (data[(yy * CANVAS + colX) * 4 + 3] > 10) {
            topY = yy;
            break;
          }
        }

        for (let yy = CANVAS - 1; yy >= 0; yy--) {
          if (data[(yy * CANVAS + colX) * 4 + 3] > 10) {
            bottomY = yy;
            break;
          }
        }

        if (topY !== null && bottomY !== null) {
          topPoints.push({ x: colX, y: topY });
          bottomPointsRaw.push({ x: colX, y: bottomY });
        }
      }

      // LIMITE INFERIOR “SEGURO”
      const bottomPoints = bottomPointsRaw.map((p, i) => {
        const top = topPoints[i];
        const safeBottom = top.y + (p.y - top.y) * 0.38; 
        return { x: p.x, y: safeBottom };
      });

      const avgTop = topPoints.reduce((s, p) => s + p.y, 0) / topPoints.length;
      const avgBottom =
        bottomPoints.reduce((s, p) => s + p.y, 0) / bottomPoints.length;

      const yMin = avgTop + 5;
      const yMax = avgBottom - 5;

      setTextoY1((yMin + yMax) / 2);
      setTextoY2((yMin + yMax) / 2 + 40);

      setShape({ topPoints, bottomPoints, yMin, yMax, imageRect: { x, y, w, h } });
    };
  }, [index]);

  // ---------------------------------------
  // COORDENADAS CORRECTAS SVG → evita “pegado” en móvil
  // ---------------------------------------
  const getSVGCoords = (clientX, clientY) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  // ---------------------------------------
  // DRAG START
  // ---------------------------------------
  const startDrag = (id, clientX, clientY) => {
    if (!shape || !svgRef.current) return;

    dragTarget.current = id;

    const { y } = getSVGCoords(clientX, clientY);
    const currentY = id === 1 ? textoY1 : textoY2;

    offsetRef.current = y - currentY;
  };

  // ---------------------------------------
  // DRAG MOVE (desktop + móvil)
  // ---------------------------------------
  const moveDrag = (clientX, clientY) => {
    if (!shape || !dragTarget.current || !svgRef.current) return;

    const { y } = getSVGCoords(clientX, clientY);

    let newY = y - offsetRef.current;

    if (newY < shape.yMin) newY = shape.yMin;
    if (newY > shape.yMax) newY = shape.yMax;

    if (dragTarget.current === 1) setTextoY1(newY);
    else setTextoY2(newY);
  };

  useEffect(() => {
    const onMouseMove = (e) => moveDrag(e.clientX, e.clientY);
    const onMouseUp = () => (dragTarget.current = null);

    const onTouchMove = (e) => {
      const t = e.touches[0];
      moveDrag(t.clientX, t.clientY);
      e.preventDefault();
    };
    const onTouchEnd = () => (dragTarget.current = null);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [shape]);

  if (!shape) return <p style={{ textAlign: "center" }}>Cargando…</p>;

  const { topPoints, bottomPoints, yMin, yMax, imageRect } = shape;

  // CURVA
  const makeCurve = (t) => {
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

  const font1 = Math.min(fontBase1, 200) * (0.75 + 0.35 * (1 - t1));
  const font2 = Math.min(fontBase2, 200) * (0.75 + 0.35 * (1 - t2));

  const d1 = makeCurve(t1);
  const d2 = makeCurve(t2);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", maxWidth: 520, padding: 10, margin: "0 auto" }}
    >
      <h3 style={{ textAlign: "center" }}>DOBO – Editor Responsive Final</h3>

      {/* TEXTOS */}
      <label>Texto 1</label>
      <input
        value={texto1}
        onChange={(e) => setTexto1(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />

      <label>Color:</label>
      <input
        type="color"
        value={color1}
        onChange={(e) => setColor1(e.target.value)}
        style={{ marginBottom: 15, display: "block" }}
      />

      <label>Tamaño (máx 200): {fontBase1}px</label>
      <input
        type="range"
        min="10"
        max="200"
        value={fontBase1}
        onChange={(e) => setFontBase1(Number(e.target.value))}
        style={{ width: "100%", marginBottom: 20 }}
      />

      <label>Texto 2</label>
      <input
        value={texto2}
        onChange={(e) => setTexto2(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />

      <label>Color:</label>
      <input
        type="color"
        value={color2}
        onChange={(e) => setColor2(e.target.value)}
        style={{ marginBottom: 15, display: "block" }}
      />

      <label>Tamaño (máx 200): {fontBase2}px</label>
      <input
        type="range"
        min="10"
        max="200"
        value={fontBase2}
        onChange={(e) => setFontBase2(Number(e.target.value))}
        style={{ width: "100%", marginBottom: 20 }}
      />

      {/* CARRUSEL */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button onClick={() => setIndex((i) => (i === 0 ? 7 : i - 1))}>◀︎</button>
        <button onClick={() => setIndex((i) => (i + 1) % 8)}>▶︎</button>
      </div>

      {/* SVG */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CANVAS} ${CANVAS}`}
        width={viewSize}
        height={viewSize}
        style={{
          width: "100%",
          height: "auto",
          background: "#fff",
          border: "1px solid #ccc",
          touchAction: "none",
        }}
      >
        <image
          href={macetas[index]}
          x={imageRect.x}
          y={imageRect.y}
          width={imageRect.w}
          height={imageRect.h}
        />

        {/* CURVA 1 */}
        <path id="curve1" d={d1} fill="none" />
        <text
          fill={color1}
          fontSize={font1}
          fontWeight="bold"
          textAnchor="middle"
          onMouseDown={(e) => startDrag(1, e.clientX, e.clientY)}
          onTouchStart={(e) => {
            const t = e.touches[0];
            startDrag(1, t.clientX, t.clientY);
          }}
          style={{ cursor: "grab" }}
        >
          <textPath href="#curve1" startOffset="50%">
            {texto1}
          </textPath>
        </text>

        {/* CURVA 2 */}
        <path id="curve2" d={d2} fill="none" />
        <text
          fill={color2}
          fontSize={font2}
          fontWeight="bold"
          textAnchor="middle"
          onMouseDown={(e) => startDrag(2, e.clientX, e.clientY)}
          onTouchStart={(e) => {
            const t = e.touches[0];
            startDrag(2, t.clientX, t.clientY);
          }}
          style={{ cursor: "grab" }}
        >
          <textPath href="#curve2" startOffset="50%">
            {texto2}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
