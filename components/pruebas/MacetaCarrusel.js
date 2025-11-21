import { useEffect, useRef, useState } from "react";

export default function MacetaCarrusel() {
  const [texto, setTexto] = useState("Texto DOBO");
  const [index, setIndex] = useState(0);

  // posición vertical del texto (en coords del SVG)
  const [textoY, setTextoY] = useState(300);

  // control manual del tamaño base
  const [fontBase, setFontBase] = useState(28);

  const [shape, setShape] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef(0);
  const svgRef = useRef(null);

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

  const CANVAS_SIZE = 500;
  const SAMPLE_COLUMNS = 40;

  // Lee la silueta REAL: curva superior y curva inferior de la maceta
  useEffect(() => {
    const img = new Image();
    img.src = macetas[index];
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const off = document.createElement("canvas");
      off.width = CANVAS_SIZE;
      off.height = CANVAS_SIZE;
      const ctx = off.getContext("2d");

      const maxW = CANVAS_SIZE * 0.75;
      const w = maxW;
      const h = (img.height / img.width) * w;
      const x = (CANVAS_SIZE - w) / 2;
      const y = (CANVAS_SIZE - h) / 2;

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(img, x, y, w, h);

      const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      const data = imageData.data;

      const topPoints = [];
      const bottomPoints = [];

      const xStart = Math.round(CANVAS_SIZE * 0.15);
      const xEnd = Math.round(CANVAS_SIZE * 0.85);

      for (let i = 0; i <= SAMPLE_COLUMNS; i++) {
        const colX = Math.round(
          xStart + ((xEnd - xStart) * i) / SAMPLE_COLUMNS
        );

        let topY = null;
        let bottomY = null;

        // primer pixel no transparente desde arriba
        for (let yy = 0; yy < CANVAS_SIZE; yy++) {
          const idx = (yy * CANVAS_SIZE + colX) * 4 + 3;
          const alpha = data[idx];
          if (alpha > 10) {
            topY = yy;
            break;
          }
        }

        // primer pixel no transparente desde abajo
        for (let yy = CANVAS_SIZE - 1; yy >= 0; yy--) {
          const idx = (yy * CANVAS_SIZE + colX) * 4 + 3;
          const alpha = data[idx];
          if (alpha > 10) {
            bottomY = yy;
            break;
          }
        }

        if (topY !== null && bottomY !== null && bottomY > topY) {
          // guardamos pares alineados (misma columna)
          topPoints.push({ x: colX, y: topY });
          bottomPoints.push({ x: colX, y: bottomY });
        }
      }

      if (!topPoints.length || !bottomPoints.length) {
        setShape(null);
        return;
      }

      const avgTop =
        topPoints.reduce((s, p) => s + p.y, 0) / topPoints.length;
      const avgBottom =
        bottomPoints.reduce((s, p) => s + p.y, 0) / bottomPoints.length;

      const yMinText = avgTop + 5;
      const yMaxText = avgBottom - 5;

      setTextoY((yMinText + yMaxText) / 2);

      setShape({
        topPoints,
        bottomPoints,
        yMinText,
        yMaxText,
        imageRect: { x, y, w, h },
      });
    };

    img.onerror = () => {
      setShape(null);
    };
  }, [index]);

  // Drag del texto (vertical)
  const onMouseDownText = (e) => {
    if (!svgRef.current || !shape) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    dragOffsetRef.current = mouseY - textoY;
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMove = (e) => {
      if (!isDragging || !shape || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      let newY = e.clientY - rect.top - dragOffsetRef.current;

      if (newY < shape.yMinText) newY = shape.yMinText;
      if (newY > shape.yMaxText) newY = shape.yMaxText;

      setTextoY(newY);
    };

    const handleUp = () => setIsDragging(false);

    if (typeof window !== "undefined") {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      }
    };
  }, [isDragging, shape]);

  if (!shape) return <p>Cargando…</p>;

  const { topPoints, bottomPoints, yMinText, yMaxText, imageRect } = shape;

  // t = posición relativa del texto entre curva superior e inferior reales
  const t =
    yMaxText === yMinText
      ? 0
      : (textoY - yMinText) / (yMaxText - yMinText);

  // 🔥 Interpolación entre curva superior e inferior:
  // AHORA interpolamos X y Y → el ancho también se ajusta al inferior.
  const interp = topPoints.map((pTop, i) => {
    const pBottom = bottomPoints[i];
    const x = pTop.x * (1 - t) + pBottom.x * t;
    const y = pTop.y * (1 - t) + pBottom.y * t;
    return { x, y };
  });

  let pathD = `M ${interp[0].x},${interp[0].y}`;
  for (let i = 1; i < interp.length; i++) {
    pathD += ` L ${interp[i].x},${interp[i].y}`;
  }

  // Escalado dinámico + control manual
  const fontScale = 0.6 + t * 0.8; // más arriba pequeño, más abajo grande
  const fontSize = fontBase * fontScale;

  const prevMaceta = () =>
    setIndex((i) => (i === 0 ? macetas.length - 1 : i - 1));
  const nextMaceta = () => setIndex((i) => (i + 1) % macetas.length);

  return (
    <div style={{ width: "100%", maxWidth: "520px" }}>
      {/* Texto */}
      <label>Texto:</label>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        style={{
          width: "100%",
          padding: "10px",
          marginBottom: "12px",
          fontSize: "18px",
        }}
      />

      {/* Tamaño base de fuente */}
      <label>Tamaño base de la fuente: {fontBase}px</label>
      <input
        type="range"
        min="10"
        max="60"
        value={fontBase}
        onChange={(e) => setFontBase(Number(e.target.value))}
        style={{ width: "100%", marginBottom: "16px" }}
      />

      {/* Carrusel simple */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <button onClick={prevMaceta}>◀︎</button>
        <button onClick={nextMaceta}>▶︎</button>
      </div>

      <svg
        ref={svgRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{
          width: "100%",
          border: "1px solid #ccc",
          background: "#fff",
          touchAction: "none",
        }}
      >
        {/* Imagen de la maceta, misma geometría que el análisis */}
        <image
          href={macetas[index]}
          x={imageRect.x}
          y={imageRect.y}
          width={imageRect.w}
          height={imageRect.h}
          preserveAspectRatio="xMidYMid meet"
        />

        {/* Path dinámico promedio entre curva superior e inferior reales */}
        <path id="curvaTexto" d={pathD} fill="none" />

        {/* Texto arrastrable que sigue el path */}
        <text
          fill="black"
          fontSize={fontSize}
          fontWeight="bold"
          textAnchor="middle"
          onMouseDown={onMouseDownText}
          style={{ cursor: "grab" }}
        >
          <textPath
            href="#curvaTexto"
            startOffset="50%"
            method="stretch"
            spacing="auto"
          >
            {texto}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
