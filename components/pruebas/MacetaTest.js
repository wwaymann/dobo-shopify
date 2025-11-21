import { useEffect, useRef, useState } from "react";

export default function MacetaTest() {
  const [macetas, setMacetas] = useState([]);
  const [index, setIndex] = useState(0);
  const [texto, setTexto] = useState("Tu DOBO aquí");
  const canvasRef = useRef(null);
  const macetaImgRef = useRef(null);

  // Cargar macetas desde tu API actual
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        const pots = data.products?.filter(
          (p) => p.tags?.includes("maceta")
        );

        // extraemos la imagen principal de cada maceta
        const cleaned = pots.map((p) => ({
          id: p.id,
          title: p.title,
          image: p.images?.[0]?.src
        }));

        setMacetas(cleaned);
      } catch (e) {
        console.error("Error cargando macetas", e);
      }
    }
    load();
  }, []);

  // Dibujar canvas cada vez que cambie maceta o texto
  useEffect(() => {
    if (!macetas.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.src = macetas[index].image;
    macetaImgRef.current = img;

    img.onload = () => {
      // limpiar canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // dibujar maceta (centrada)
      const w = canvas.width * 0.7;
      const h = (img.height / img.width) * w;
      const x = (canvas.width - w) / 2;
      const y = (canvas.height - h) / 2;

      ctx.drawImage(img, x, y, w, h);

      // -------- WARP BÁSICO DEL TEXTO ---------
      ctx.font = "bold 32px Montserrat";
      ctx.fillStyle = "#222";
      ctx.textAlign = "center";

      const baselineY = y + h * 0.55;
      const curvature = 0.004; // ajusta para curvar más o menos

      const letters = texto.split("");
      const totalWidth = ctx.measureText(texto).width;
      const startX = canvas.width / 2 - totalWidth / 2;

      let offsetX = startX;

      for (let letter of letters) {
        const charWidth = ctx.measureText(letter).width;

        // curva tipo arco sencillo
        const dx = offsetX - canvas.width / 2;
        const dy = Math.pow(dx, 2) * curvature;

        ctx.save();
        ctx.translate(offsetX, baselineY + dy);
        ctx.fillText(letter, 0, 0);
        ctx.restore();

        offsetX += charWidth;
      }
    };
  }, [macetas, index, texto]);

  if (!macetas.length) return <p>Cargando macetas...</p>;

  const goNext = () =>
    setIndex((prev) => (prev + 1) % macetas.length);

  const goPrev = () =>
    setIndex((prev) =>
      prev === 0 ? macetas.length - 1 : prev - 1
    );

  return (
    <div style={{ width: "100%", maxWidth: "500px" }}>
      <label
        style={{
          display: "block",
          fontSize: "16px",
          marginBottom: "8px",
        }}
      >
        Texto del DOBO:
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
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <button onClick={goPrev}>◀︎</button>
        <button onClick={goNext}>▶︎</button>
      </div>

      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        style={{
          border: "1px solid #ddd",
          width: "100%",
          background: "#fff",
        }}
      />
    </div>
  );
}
