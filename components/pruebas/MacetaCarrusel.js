import { useEffect, useRef, useState } from "react";

export default function MacetaCarrusel() {
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
  const [index, setIndex] = useState(0);
  const [texto, setTexto] = useState("Texto DOBO");
  const [fontBase, setFontBase] = useState(28);
  const [textoY, setTextoY] = useState(300);

  const [shape, setShape] = useState(null);

  const isDragging = useRef(false);
  const offsetRef = useRef(0);
  const svgRef = useRef(null);

  // -----------------------------------------------------
  // LECTURA DE CURVAS SUPERIOR E INFERIOR DE LA MACETA
  // -----------------------------------------------------
  useEffect(() => {
    const img = new Image();
    img.src = macetas[index];

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

      const SAMPLE_COLUMNS = 40;
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

        // borde superior
        for (let yy = 0; yy < CANVAS_SIZE; yy++) {
          if (data[(yy * CANVAS_SIZE + colX) * 4 + 3] > 10) {
            topY = yy;
            break;
          }
        }

        // borde inferior
        for (let yy = CANVAS_SIZE - 1; yy >= 0; yy--) {
          if (data[(yy * CANVAS_SIZE + colX) * 4 + 3] > 10) {
            bottomY = yy;
            break;
          }
        }

        if (topY != null && bottomY != null) {
          topPoints.push({ x: colX, y: topY });
          bottomPoints.push({ x: colX, y: bottomY });
        }
      }

      const avgTop =
        topPoints.reduce((s, p) => s + p.y, 0) / topPoints.length;
      const avgBottom =
        bottomPoints.reduce((s, p) => s + p.y, 0) / bottomPoints.length;

      setTextoY((avgTop + avgBottom) / 2);

      setShape({
        topPoints,
        bottomPoints,
        yMinText: avgTop + 5,
        yMaxText: avgBottom - 5,
        imageRect: { x, y, w, h },
      });
    };
  }, [index]);

  // -----------------------------------------------------
  // DRAG MOUSE + TOUCH
  // -----------------------------------------------------
  const startDragMouse = (e) => {
    if (!shape || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    offsetRef.current = e.clientY - rect.top - textoY;

    isDragging.current = true;
  };

  const startDragTouch = (e) => {
    if (!shape || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    offsetRef.current = e.touches[0].clientY - rect.top - textoY;

    isDragging.current = true;
    e.preventDefault();
  };

  const moveDrag = (clientY) => {
    if (!isDragging.current || !shape || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();

    let newY = clientY - rect.top - offsetRef.current;

    if (newY < shape.yMinText) newY = shape.yMinText;
    if (newY > shape.yMaxText) newY = shape.yMaxText;

    setTextoY(newY);
  };

  useEffect(() => {
    const moveMouse = (e) => moveDrag(e.clientY);
    const moveTouch = (e) => moveDrag(e.touches[0].clientY);
    const stop = () => (isDragging.current = false);

    window.addEventListener("mousemove", moveMouse);
    window.addEventListener("touchmove", moveTouch, { passive: false });
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);

    return () => {
      window.removeEventListener("mousemove", moveMouse);
      window.removeEventListener("touchmove", moveTouch);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchend", stop);
    };
  }, [shape]);

  if (!shape) return <p>Cargando…</p>;

  const { topPoints, bottomPoints, yMinText, yMaxText, imageRect } = shape;

  const t = (textoY - yMinText) / (yMaxText - yMinText);

  // -----------------------------------------------
  // VERSIÓN A → DEFORMACIÓN REAL PERO CONTROLADA
  // -----------------------------------------------
  const deformFactor = 0.15; // controla cuánto sigue el cono

  const interp = topPoints.map((pTop, i) => {
    const pBottom = bottomPoints[i];

    return {
      x: pTop.x * (1 - deformFactor * t) + pBottom.x * (deformFactor * t),
      y: pTop.y * (1 - t) + pBottom.y * t,
    };
  });

  let pathD = `M ${interp[0].x},${interp[0].y}`;
  for (let i = 1; i < interp.length; i++) {
    pathD += ` L ${interp[i].x},${interp[i].y}`;
  }

  const fontSize = fontBase * (0.6 + t * 0.8);

  return (
    <div style={{ width: "100%", maxWidth: 520 }}>
      <label>Texto:</label>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 12 }}
      />

      <label>Tamaño base: {fontBase}px</label>
      <input
        type="range"
        min="10"
        max="60"
        value={fontBase}
        onChange={(e) => setFontBase(Number(e.target.value))}
        style={{ width: "100%", marginBottom: 16 }}
      />

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button onClick={() => setIndex((i) => (i === 0 ? 7 : i - 1))}>◀︎</button>
        <button onClick={() => setIndex((i) => (i + 1) % 8)}>▶︎</button>
      </div>

      <svg
        ref={svgRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{
          width: "100%",
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

        <path id="curvaTexto" d={pathD} fill="none" />

        <text
          fontSize={fontSize}
          fontWeight="bold"
          textAnchor="middle"
          onMouseDown={startDragMouse}
          onTouchStart={startDragTouch}
          style={{ cursor: "grab" }}
        >
          <textPath href="#curvaTexto" startOffset="50%">
            {texto}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
