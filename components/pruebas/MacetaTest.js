import { useEffect, useRef, useState } from "react";

export default function MacetaPrueba() {
  const [texto, setTexto] = useState("Texto DOBO");
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // cargamos tu imagen fija desde /public
    const img = new Image();
    img.src = "/maceta4.png";

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // dimensiones de la maceta dentro del canvas
      const w = canvas.width * 0.75;
      const h = (img.height / img.width) * w;
      const x = (canvas.width - w) / 2;
      const y = (canvas.height - h) / 2;

      ctx.drawImage(img, x, y, w, h);

      // ----- TEXTO CURVADO SIMPLE -----
      ctx.font = "bold 34px sans-serif";
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";

      const baselineY = y + h * 0.55; // zona donde cae el texto
      const curvature = 0.0025;       // cuánta curva aplicar (ajustable)

      const letters = texto.split("");
      const textWidth = ctx.measureText(texto).width;
      let offsetX = canvas.width / 2 - textWidth / 2;

      for (let l of letters) {
        const w = ctx.measureText(l).width;

        // curva tipo arco
        const dx = offsetX - canvas.width / 2;
        const dy = dx * dx * curvature;

        ctx.save();
        ctx.translate(offsetX, baselineY + dy);
        ctx.fillText(l, 0, 0);
        ctx.restore();

        offsetX += w;
      }
    };
  }, [texto]); // redibuja solo cuando cambie el texto

  return (
    <div style={{ width: "100%", maxWidth: "500px" }}>
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
