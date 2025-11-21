import { useState } from "react";

export default function MacetaCarrusel() {
  const [texto, setTexto] = useState("Texto DOBO");
  const [index, setIndex] = useState(0);

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

  // Curvatura distinta por maceta
  const curvas = [
    180, // maceta1
    220,
    260,
    180,
    240,
    200,
    280,
    160, // maceta8
  ];

  const siguiente = () =>
    setIndex((prev) => (prev + 1) % macetas.length);

  const anterior = () =>
    setIndex((prev) =>
      prev === 0 ? macetas.length - 1 : prev - 1
    );

  const radio = curvas[index];
  const arcoWidth = 420;

  const pathData = `
    M ${250 - arcoWidth / 2}, 300
    A ${radio} ${radio} 0 0 1 ${250 + arcoWidth / 2} 300
  `;

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

      <div
        style={{
          position: "relative",
          width: "500px",
          height: "500px",
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

        {/** TEXTO CURVADO REAL */}
        <svg
          width="500"
          height="500"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
        >
          <path id="arco" d={pathData} fill="none" />
          <text
            fill="black"
            fontSize="32"
            fontWeight="bold"
            textAnchor="middle"
          >
            <textPath
              href="#arco"
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
