import { useEffect, useRef, useState } from "react";

export default function MacetaCarrusel() {
  const [texto, setTexto] = useState("Texto DOBO");
  const [index, setIndex] = useState(0);

  const [textoY, setTextoY] = useState(300);
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

        for (let yy = 0; yy < CANVAS_SIZE; yy++) {
          const idx = (yy * CANVAS_SIZE + colX) * 4 + 3;
          if (data[idx] > 10) {
            topY = yy;
            break;
          }
        }

        for (let yy = CANVAS_SIZE - 1; yy >= 0; yy--) {
          const idx = (yy * CANVAS_SIZE + colX) * 4 + 3;
          if (data[idx] > 10) {
            bottomY = yy;
            break;
          }
        }

        if (topY && bottomY && bottomY > topY) {
          topPoints.push({ x: colX, y: topY });
          bottomPoints.push({ x: colX, y: bottomY });
        }
      }

      const avgTop =
        topPoints.reduce((acc, p) => acc + p.y, 0) / topPoints.length;
      const avgBot =
        bottomPoints.reduce((acc, p) => acc + p.y, 0) /
        bottomPoints.length;

      setTextoY((avgTop + avgBot) / 2);

      setShape({
        topPoints,
        bottomPoints,
        yMinText: avgTop + 5,
        yMaxText: avgBot - 5,
        imageRect: { x, y, w, h },
      });
    };
  }, [index]);

  const onMouseDown = (e) => {
    if (!svgRef.current || !shape) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    dragOffsetRef.current = mouseY - textoY;
    setIsDragging(true);
  };

  const onMouseMove = (e) => {
    if (!isDragging || !shape || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    let newY = e.clientY - rect.top - dragOffsetRef.current;

    if (newY < shape.yMinText) newY = shape.yMinText;
    if (newY > shape.yMaxText) newY = shape.yMaxText;

    setTextoY(newY);
  };

  const onMouseUp = () => {
    setIsDragging(false);
  };

  if (typeof window !== "undefined") {
    window.onmouseup = onMouseUp;
    window.onmousemove = onMouseMove;
  }

  if (!shape) return <p>Cargando…</p>;

  const { topPoints, bottomPoints, yMinText, yMaxText, imageRect } = shape;

  const t = (textoY - yMinText) / (yMaxText - yMinText);

  const interp = topPoints.map((pTop, i) => {
    const pBottom = bottomPoints[i];
    const y = pTop.y * (1 - t) + pBottom.y * t;
    return { x: pTop.x, y };
  });

  let pathD = `M ${interp[0].x},${interp[0].y}`;
  for (let i = 1; i < interp.length; i++) {
    pathD += ` L ${interp[i].x},${interp[i].y}`;
  }

  // ESCALADO DINÁMICO:
  const fontMin = 18; // más arriba
  const fontMax = 36; // más abajo
  const fontSize = fontMin * (1 - t) + fontMax * t;

  return (
    <div style={{ width: "100%", maxWidth: "520px" }}>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        style={{ width: "100%", padding: "10px", marginBottom: "20px" }}
      />

      <svg
        ref={svgRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{
          width: "100%",
          border: "1px solid #ccc",
          background: "#fff",
        }}
      >
        <image
          href={macetas[index]}
          x={imageRect.x}
          y={imageRect.y}
          width={imageRect.w}
          height={imageRect.h}
        />

        <path id="dynamicPath" d={pathD} fill="none" />

        <text
          fill="black"
          fontSize={fontSize}
          fontWeight="bold"
          textAnchor="middle"
          style={{ cursor: "grab" }}
          onMouseDown={onMouseDown}
        >
          <textPath
            href="#dynamicPath"
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
