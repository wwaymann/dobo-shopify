import { useEffect, useRef, useState } from "react";

export default function MacetaTest() {
  const [macetas, setMacetas] = useState([]);
  const [index, setIndex] = useState(0);
  const [texto, setTexto] = useState("Texto DOBO");
  const canvasRef = useRef(null);

  // Cargar productos desde Shopify
  useEffect(() => {
    async function cargar() {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();

        // Verifica estructura real del API
        const productos = data?.products || [];

        // Extrae solo la primera imagen de cada producto
        const procesado = productos
          .map((p) => ({
            id: p.id,
            title: p.title,
            image: p.images?.[0]?.src || null,
          }))
          .filter((p) => p.image); // solo productos que tengan imagen

        setMacetas(procesado);
      } catch (err) {
        console.error("ERROR cargando productos:", err);
      }
    }

    cargar();
  }, []);

  // Redibuja cada vez que cambia la maceta o texto
  useEffect(() => {
    if (!macetas.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = macetas[index].image;

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width * 0.7;
      const h = (img.height / img.width) * w;
      const x = (canvas.width - w) / 2;
      const y = (canvas.height - h) / 2;

      ctx.drawImage(img, x, y, w, h);

      // ---------- TEXTO CURVADO SIMPLE ----------
      ctx.font = "bold 34px sans-serif";
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";

      const baselineY = y + h * 0.55;
      const curvature = 0.0028; // ajustable

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

    img.onerror = () => {
      console.error("No se pudo cargar la imagen:", img.src);
    };
  }, [macetas, index, texto]);

  if (!macetas.length) {
    return <p>Cargando macetas…</p>;
  }

  const siguiente = () =>
    setIndex((prev) => (prev + 1) % macetas.length);

  const anterior = () =>
    setIndex((prev) => (prev === 0 ? macetas.length - 1 : prev - 1));

  return (
    <div style={{ width: "100%", maxWidth: "520px" }}>
      <label style={{ display: "block", marginBottom: "6px" }}>
        Texto DOBO:
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
