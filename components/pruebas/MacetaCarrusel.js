import { useEffect, useRef, useState } from "react";

export default function MacetaCarrusel() {
  const [texto, setTexto] = useState("Texto DOBO");
  const [index, setIndex] = useState(0);
  const canvasRef = useRef(null);

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

  // --- FUNCIÓN CLAVE ---
  function calcularCurvaturaSegunMaceta(imgWidth, imgHeight) {
    const proporción = imgHeight / imgWidth;

    // Macetas más altas → curva más suave
    // Macetas más anchas → curva más marcada
    let curvaBase = 0.001;

    if (proporción < 1.2) {
      // maceta ancha
      curvaBase = 0.0028;
    } else if (proporción < 1.5) {
      curvaBase = 0.002;
    } else if (proporción < 2) {
      curvaBase = 0.0016;
    } else {
      // maceta muy alta
      curvaBase = 0.001;
    }

    return curvaBase;
  }

  // --- DIBUJAR TODO ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.src = macetas[index];
    img.crossOrigin = "anonymous";

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Tamaño de maceta en canvas
      const w = canvas.width * 0.75;
      const h = (img.height / img.width) * w;
      const x = (canvas.width - w) / 2;
      const y = (canvas.height - h) / 2;

      ctx.drawImage(img, x, y, w, h);

      // --- CALCULAR CURVATURA REAL POR MACETA ---
      const curvature = calcularCurvaturaSegunMaceta(img.width, img.height);

      // --- DIBUJAR TEXTO CON WARP DINÁMICO ---
      ctx.font = "bold 34px sans-serif";
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";

      // posición vertical del texto
      const baselineY = y + h * 0.55;

      const letters = texto.split("");
      const totalWidth = ctx.measureText(texto).width;
      let offsetX = canvas.width / 2 - totalWidth / 2;

      for (let l of letters) {
        const letterWidth = ctx.measureText(l).width;

        // distancia horizontal desde centro
        const dx = offsetX - canvas.width / 2;

        // curva dinámica REAL
        const dy = dx * dx * curvature;

        ctx.save();
        ctx.translate(offsetX, baselineY + dy);
        ctx.fillText(l, 0, 0);
        ctx.restore();

        offsetX += letterWidth;
      }
    };
  }, [index, texto]);

  // botones
  const siguiente = () =>
    setIndex((prev) => (prev + 1) % macetas.length);

  const anterior = () =>
    setIndex((prev) => (prev === 0 ? macetas.length - 1 : prev - 1));

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
