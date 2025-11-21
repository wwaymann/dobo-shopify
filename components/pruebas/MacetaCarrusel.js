import { useEffect, useRef, useState } from "react";

export default function MacetaCarrusel() {
  const [texto, setTexto] = useState("Texto DOBO");
  const [index, setIndex] = useState(0);
  const canvasRef = useRef(null);

  // Lista fija de imágenes en public/
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

  // Dibujar la maceta y el texto curvado
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.src = macetas[index];

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Tamaño de maceta
      const w = canvas.width * 0.75;
      const h = (img.height / img.width) * w;
      const x = (canvas.width - w) / 2;
      const y = (canvas.height - h) / 2;

      ctx.drawImage(img, x, y, w, h);

      // ----- TEXTO CURVADO -----
      ctx.font = "bold 32px sans-serif";
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";

      const baselineY = y + h * 0.55; // zona de texto
      const curvature = 0.0025;       // curva ajustable

      const letters = texto.split("");
      const textWidth = ctx.measureText(texto).width;
      let offsetX = canvas.width / 2 - textWidth / 2;

      for (let l of letters) {
        const w = ctx.measureText(l).width;
        const dx = offsetX - canvas.width / 2;
        const dy = dx * dx * curvature;

        ctx.save();
        ctx.translate(offsetX, baselineY + dy);
        ctx.fillText(l, 0, 0);
        ctx.restore();

        offsetX += w;
      }
    };
  }, [index, texto]);

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
        type="text"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        style={{
          width: "100%",
          padding: "10px",
          fontSize: "18px",
          marginBottom: "18px",
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

      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        style={{
          width: "100%",
          border: "1px solid #ccc",
          background: "#fff",
        }}
      />
    </div>
  );
}
