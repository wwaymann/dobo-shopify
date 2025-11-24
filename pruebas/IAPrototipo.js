import { useState } from "react";

export default function IAPrototipo() {
  // CARRUSELES DE PRUEBA (usa tus imágenes reales si quieres)
  const macetas = [
    { id: 1, name: "Maceta 01", img: "/public/maceta1.png" },
    { id: 2, name: "Maceta 02", img: "/public/maceta2.png" },
    { id: 3, name: "Maceta 03", img: "/public/maceta3.png" },
  ];

  const plantas = [
    { id: 1, name: "Planta 01", img: "/public/planta1.png" },
    { id: 2, name: "Planta 02", img: "/public/planta2.png" },
    { id: 3, name: "Planta 03", img: "/public/planta3.png" },
  ];

  const [macetaIndex, setMacetaIndex] = useState(0);
  const [plantaIndex, setPlantaIndex] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [resultadoIA, setResultadoIA] = useState(null);
  const [cargando, setCargando] = useState(false);

  // Cambiar maceta/planta
  const nextMaceta = () =>
    setMacetaIndex((prev) => (prev + 1) % macetas.length);
  const prevMaceta = () =>
    setMacetaIndex((prev) => (prev - 1 + macetas.length) % macetas.length);

  const nextPlanta = () =>
    setPlantaIndex((prev) => (prev + 1) % plantas.length);
  const prevPlanta = () =>
    setPlantaIndex((prev) => (prev - 1 + plantas.length) % plantas.length);

  // Simulación de IA (luego se conecta a OpenAI o a tu servidor)
  const generarConIA = async () => {
    if (!prompt) return;

    setCargando(true);
    setResultadoIA(null);

    // Simulación (2 segundos)
    await new Promise((res) => setTimeout(res, 2000));

    setResultadoIA(
      "https://placehold.co/500x500/png?text=Resultado+IA"
    );

    setCargando(false);
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 900,
        margin: "0 auto",
        padding: 20,
        textAlign: "center",
        fontFamily: "sans-serif",
      }}
    >
      <h2>Prueba de Generación IA – DOBO</h2>

      {/* CARRUSEL MACETAS */}
      <div style={{ marginTop: 20 }}>
        <h4>Maceta</h4>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
          <button onClick={prevMaceta}>◀</button>
          <img
            src={macetas[macetaIndex].img}
            alt="maceta"
            style={{ width: 80, height: 80, objectFit: "contain" }}
          />
          <button onClick={nextMaceta}>▶</button>
        </div>
        <p>{macetas[macetaIndex].name}</p>
      </div>

      {/* CARRUSEL PLANTAS */}
      <div style={{ marginTop: 30 }}>
        <h4>Planta</h4>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
          <button onClick={prevPlanta}>◀</button>
          <img
            src={plantas[plantaIndex].img}
            alt="planta"
            style={{ width: 80, height: 80, objectFit: "contain" }}
          />
          <button onClick={nextPlanta}>▶</button>
        </div>
        <p>{plantas[plantaIndex].name}</p>
      </div>

      {/* INPUT CONTEXTUAL */}
      <div style={{ marginTop: 40 }}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe tu idea: Ej. 'Diseño para el día de la mamá para Juanita, estilo floral delicado'."
          style={{
            width: "100%",
            height: 100,
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ccc",
            resize: "none",
          }}
        />
        <button
          onClick={generarConIA}
          style={{
            marginTop: 10,
            padding: "10px 20px",
            background: "#333",
            color: "white",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
          }}
        >
          Generar con IA
        </button>
      </div>

      {/* RESULTADO */}
      <div style={{ marginTop: 40 }}>
        {cargando && <p>Generando diseño…</p>}

        {resultadoIA && (
          <img
            src={resultadoIA}
            alt="resultado"
            style={{
              width: "100%",
              maxWidth: 400,
              margin: "0 auto",
              borderRadius: 12,
            }}
          />
        )}
      </div>
    </div>
  );
}
