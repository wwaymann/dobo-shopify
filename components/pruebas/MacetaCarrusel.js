import { useRef, useState, useEffect } from "react";
import { useMacetaCurvas } from "./useMacetaCurvas";

export default function MacetaCarrusel_A() {
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
  const [texto, setTexto] = useState("Texto DOBO");
  const [fontBase, setFontBase] = useState(28);
  const [textoY, setTextoY] = useState(300);

  const shape = useMacetaCurvas(macetas[index]);
  const svgRef = useRef(null);
  const dragRef = useRef(false);
  const offsetRef = useRef(0);

  // --- drag básico (mouse + touch) ---
  const startDrag = (clientY) => {
    if (!shape) return;
    dragRef.current = true;
    offsetRef.current = clientY - textoY;
  };

  const moveDrag = (clientY) => {
    if (!dragRef.current || !shape) return;
    let newY = clientY - offsetRef.current;

    if (newY < shape.yMinText) newY = shape.yMinText;
    if (newY > shape.yMaxText) newY = shape.yMaxText;

    setTextoY(newY);
  };

  useEffect(() => {
    const move = (e) => moveDrag(e.clientY);
    const moveTouch = (e) => moveDrag(e.touches[0].clientY);
    const end = () => (dragRef.current = false);

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

  const { topPoints, bottomPoints, yMinText, yMaxText, imageRect } = shape;

  const t = (textoY - yMinText) / (yMaxText - yMinText);

  // ⭐ DEFORMACIÓN SUAVE CONTROLADA
  const deformFactor = 0.15; // controla cuanto “sigue” el cono
  const interp = topPoints.map((pTop, i) => {
    const pBottom = bottomPoints[i];
    const fx = pTop.x * (1 - deformFactor * t) + pBottom.x * (deformFactor * t);
    const fy = pTop.y * (1 - t) + pBottom.y * t;
    return { x: fx, y: fy };
  });

  let pathD = `M ${interp[0].x} ${interp[0].y}`;
  for (let i = 1; i < interp.length; i++) pathD += ` L ${interp[i].x} ${interp[i].y}`;

  const fontSize = fontBase * (0.6 + t * 0.8);

  return (
    <div style={{ width: "100%", maxWidth: 520 }}>
      <label>Texto:</label>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        style={{ width: "100%", marginBottom: 12, padding: 8 }}
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
        width={500}
        height={500}
        style={{ width: "100%", background: "#fff", border: "1px solid #ccc" }}
      >
        <image
          href={macetas[index]}
          x={imageRect.x}
          y={imageRect.y}
          width={imageRect.w}
          height={imageRect.h}
        />

        <path id="curvaA" d={pathD} fill="none" />

        <text
          fontSize={fontSize}
          fontWeight="bold"
          textAnchor="middle"
          onMouseDown={(e) => startDrag(e.clientY)}
          onTouchStart={(e) => startDrag(e.touches[0].clientY)}
          style={{ cursor: "grab" }}
        >
          <textPath href="#curvaA" startOffset="50%">
            {texto}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
