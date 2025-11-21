import { useEffect, useRef, useState } from "react";

export default function MacetaCarrusel() {
  const [texto, setTexto] = useState("Texto DOBO");
  const [index, setIndex] = useState(0);

  // posición vertical del texto (en coords del SVG)
  const [textoY, setTextoY] = useState(300);

  const [shape, setShape] = useState(null); // bordes superior e inferior detectados
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef(0);
  const svgRef = useRef(null);

  // Lista fija de macetas locales
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

  // Dimensiones "lienzo" de trabajo
  const CANVAS_SIZE = 500;
  const SAMPLE_COLUMNS = 40; // cuántos puntos usamos para el path

  // Recalcular bordes de la maceta cada vez que cambia la imagen
  useEffect(() => {
    const img = new Image();
    img.src = macetas[index];
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const offCanvas = document.createElement("canvas");
      offCanvas.width = CANVAS_SIZE;
      offCanvas.height = CANVAS_SIZE;
      const ctx = offCanvas.getContext("2d");

      // dibujamos la maceta centrada, escala 0.75 del ancho
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

        // buscar primer pixel no transparente desde arriba
        for (let yy = 0; yy < CANVAS_SIZE; yy++) {
          const idx = (yy * CANVAS_SIZE + colX) * 4 + 3;
          const alpha = data[idx];
          if (alpha > 10) {
            topY = yy;
            break;
          }
        }

        // buscar primer pixel no transparente desde abajo
        for (let yy = CANVAS_SIZE - 1; yy >= 0; yy--) {
          const idx = (yy * CANVAS_SIZE + colX) * 4 + 3;
          const alpha = data[idx];
          if (alpha > 10) {
            bottomY = yy;
            break;
          }
        }

        if (topY !== null && bottomY !== null && bottomY > topY) {
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

  // Manejo de drag del texto
  const handleMouseDownText = (e) => {
    if (!svgRef.current || !shape) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    dragOffsetRef.current = mouseY - textoY;
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !shape || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    let newY = mouseY - dragOffsetRef.current;

    if (newY < shape.yMinText) newY = shape.yMinText;
    if (newY > shape.yMaxText) newY = shape.yMaxText;

    setTextoY(newY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const siguiente = () =>
    setIndex((prev) => (prev + 1) % macetas.length);

  const anterior = () =>
    setIndex((prev) =>
      prev === 0 ? macetas.length - 1 : prev - 1
    );

  if (!shape) {
    return (
      <div style={{ width: "100%", maxWidth: "520px" }}>
        <p>Cargando forma de la maceta…</p>
      </div>
    );
  }

  // Interpolar path entre borde superior e inferior según textoY
  const { topPoints, bottomPoints, yMinText, yMaxText, imageRect } = shape;

  const t =
    yMaxText === yMinText
      ? 0
      : Math.min(
          1,
          Math.max(0, (textoY - yMinText) / (yMaxText - yMinText))
        );

  const interpPoints = topPoints.map((pTop, i) => {
    const pBottom = bottomPoints[i];
    const y =
      pTop.y * (1 - t) + (pBottom ? pBottom.y : pTop.y) * t;
    return { x: pTop.x, y };
  });

  let pathD = "";
  if (interpPoints.length > 0) {
    pathD = `M ${interpPoints[0].x},${interpPoints[0].y}`;
    for (let i = 1; i < interpPoints.length; i++) {
      pathD += ` L ${interpPoints[i].x},${interpPoints[i].y}`;
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: "520px" }}>
      <label style={{ display: "block", marginBottom: "8px" }}>
        Escribe tu texto:
      </label>

      <input
        type="text"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        style={{
          width: "100%",
          padding: "10px",
          fontSize: "18px",
          marginBottom: "20px",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <button onClick={anterior}>◀︎</button>
        <button onClick={siguiente}>▶︎</button>
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
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* imagen de la maceta, misma geometría que el análisis */}
        <image
          href={macetas[index]}
          x={imageRect.x}
          y={imageRect.y}
          width={imageRect.w}
          height={imageRect.h}
          preserveAspectRatio="xMidYMid meet"
        />

        {/* path dinámico generado por el promedio entre borde superior e inferior */}
        <path id="curvaTexto" d={pathD} fill="none" />

        <text
          fill="black"
          fontSize="32"
          fontWeight="bold"
          textAnchor="middle"
          style={{ cursor: "grab" }}
          onMouseDown={handleMouseDownText}
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
