import { useState, useRef } from "react";

export default function MacetaCarrusel() {
  const [texto, setTexto] = useState("Texto DOBO");
  const [index, setIndex] = useState(0);

  // posición vertical del texto (inicial)
  const [textoY, setTextoY] = useState(310);
  const dragging = useRef(false);
  const offsetY = useRef(0);

  // Lista fija de macetas
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

  // Curvaturas específicas por maceta
  const curvasSup = [260, 240, 300, 180, 260, 260, 280, 220];
  const curvasInf = [120, 110, 140, 100, 120, 115, 150, 130];

  const radioSup = curvasSup[index];
  const radioInf = curvasInf[index];

  const arcoWidth = 420;

  const ySup = 270; // posición curva superior
  const yInf = 360; // posición curva inferior

  // --------- DRAG DEL TEXTO -----------
  const onMouseDown = (e) => {
    dragging.current = true;
    offsetY.current = e.clientY - textoY;
  };

  const onMouseMove = (e) => {
    if (!dragging.current) return;
    let nuevaY = e.clientY - offsetY.current;

    // límites del texto
    if (nuevaY < ySup) nuevaY = ySup;
    if (nuevaY > yInf) nuevaY = yInf;

    setTextoY(nuevaY);
  };

  const onMouseUp = () => {
    dragging.current = false;
  };

  // registrar eventos globales
  if (typeof window !== "undefined") {
    window.onmouseup = onMouseUp;
    window.onmousemove = onMouseMove;
  }

  // -------- CÁLCULO DEL PROMEDIO DE CURVATURA --------

  const t = (textoY - ySup) / (yInf - ySup); // 0–1
  const radioFinal = radioSup * (1 - t) + radioInf * t;

  // Generar PATH dinámico según textoY y curva promedio
  const path = `
    M ${250 - arcoWidth / 2}, ${textoY}
    A ${radioFinal} ${radioFinal} 0 0 1 ${250 + arcoWidth / 2} ${textoY}
  `;

  const siguiente = () =>
    setIndex((prev) => (prev + 1) % macetas.length);

  const anterior = () =>
    setIndex((prev) =>
      prev === 0 ? macetas.length - 1 : prev - 1
    );

  return (
    <div style={{ width: "100%", maxWidth: "520px" }}>
      <label style={{ display: "block", marginBottom: "8px" }}>
        Escribe tu texto:
      </label>

      <input
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

      <div
        style={{
          position: "relative",
          width: "500px",
          height: "500px",
          userSelect: "none",
        }}
      >
        <img
          src={macetas[index]}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />

        <svg
          width="500"
          height="500"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          <path id="curva" d={path} fill="none" />

          <text
            fill="black"
            fontSize="32"
            fontWeight="bold"
            textAnchor="middle"
            onMouseDown={onMouseDown}
            style={{ cursor: "grab" }}
          >
            <textPath
              href="#curva"
              startOffset="50%"
              method="stretch"
              spacing="auto"
            >
              {texto}
            </textPath>
          </text>
        </svg>
      </div>
    </div>
  );
}
