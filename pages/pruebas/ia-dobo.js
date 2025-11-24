import { useState, useEffect, useRef } from "react";

const MACETAS = [
  { id: 1, name: "Maceta 01", img: "/maceta1.png" },
  { id: 2, name: "Maceta 02", img: "/maceta2.png" },
  { id: 3, name: "Maceta 03", img: "/maceta3.png" },
];

const PLANTAS = [
  { id: 1, name: "Planta 01", img: "/planta1.png" },
  { id: 2, name: "Planta 02", img: "/planta2.png" },
  { id: 3, name: "Planta 03", img: "/planta3.png" },
];

export default function IADoboPage() {
  const [macetaIndex, setMacetaIndex] = useState(0);
  const [plantaIndex, setPlantaIndex] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [designUrl, setDesignUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const designObjectRef = useRef(null);

  const nextMaceta = () =>
    setMacetaIndex((prev) => (prev + 1) % MACETAS.length);
  const prevMaceta = () =>
    setMacetaIndex((prev) => (prev - 1 + MACETAS.length) % MACETAS.length);

  const nextPlanta = () =>
    setPlantaIndex((prev) => (prev + 1) % PLANTAS.length);
  const prevPlanta = () =>
    setPlantaIndex((prev) => (prev - 1 + PLANTAS.length) % PLANTAS.length);

  const macetaActual = MACETAS[macetaIndex];
  const plantaActual = PLANTAS[plantaIndex];

  useEffect(() => {
    let disposed = false;

    async function init() {
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;

      const fabricModule = await import("fabric");
      const fabric =
        fabricModule.fabric ||
        fabricModule.default ||
        fabricModule;

      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
      }

      const canvas = new fabric.Canvas(canvasEl, {
        backgroundColor: "#fafafa",
        selection: false,
      });
      fabricCanvasRef.current = canvas;

      const w = canvas.getWidth();
      const h = canvas.getHeight();

      const load = (url) =>
        new Promise((resolve, reject) => {
          fabric.Image.fromURL(
            url,
            (img) => (img ? resolve(img) : reject(url)),
            { crossOrigin: "anonymous" }
          );
        });

      try {
        const maceta = await load(macetaActual.img);
        const sMaceta = (w * 0.7) / maceta.width;
        maceta.set({
          left: w / 2,
          top: h * 0.62,
          originX: "center",
          originY: "center",
          selectable: false,
        });
        maceta.scale(sMaceta);
        canvas.add(maceta);

        const planta = await load(plantaActual.img);
        const sPlanta = (w * 0.6) / planta.width;
        planta.set({
          left: w / 2,
          top: h * 0.22,
          originX: "center",
          originY: "center",
          selectable: false,
        });
        planta.scale(sPlanta);
        canvas.add(planta);

        if (designUrl) {
          const diseño = await load(designUrl);
          const sDiseño = (w * 0.45) / diseño.width;

          diseño.set({
            left: w / 2,
            top: h * 0.63,
            originX: "center",
            originY: "center",
            selectable: true,
          });

          diseño.scale(sDiseño);
          canvas.add(diseño);
          designObjectRef.current = diseño;
          canvas.setActiveObject(diseño);
        } else {
          designObjectRef.current = null;
        }

        canvas.renderAll();
      } catch (err) {
        console.error("Error cargando imágenes:", err);
      }
    }

    if (!disposed) init();

    return () => {
      disposed = true;
    };
  }, [macetaIndex, plantaIndex, designUrl]);

  const handleGenerateIA = async () => {
    if (!prompt.trim()) {
      alert("Escribe algo primero.");
      return;
    }

    setIsGenerating(true);

    setTimeout(() => {
      setDesignUrl("/demo-design.png"); // imagen dummy
      setIsGenerating(false);
    }, 1200);
  };

  const downloadFile = (dataUrl, filename) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  const exportPNGComplete = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL({
      format: "png",
      multiplier: 2,
    });
    downloadFile(dataUrl, "dobo-completo.png");
  };

  const exportPNGDesign = async () => {
    const diseño = designObjectRef.current;
    if (!diseño) {
      alert("No hay diseño IA aún.");
      return;
    }

    const fabricModule = await import("fabric");
    const fabric =
      fabricModule.fabric || fabricModule.default || fabricModule;

    const sw = diseño.getScaledWidth();
    const sh = diseño.getScaledHeight();

    const tmp = new fabric.Canvas(document.createElement("canvas"), {
      width: sw,
      height: sh,
    });

    const clone = fabric.util.object.clone(diseño);
    clone.set({
      left: sw / 2,
      top: sh / 2,
      originX: "center",
      originY: "center",
    });
    tmp.add(clone);
    tmp.renderAll();

    const dataUrl = tmp.toDataURL({
      format: "png",
      multiplier: 2,
    });

    downloadFile(dataUrl, "dobo-design-ia.png");
    tmp.dispose();
  };

  const exportSVGDesign = () => {
    const diseño = designObjectRef.current;
    if (!diseño) {
      alert("No hay diseño IA aún.");
      return;
    }

    const svg = diseño.toSVG();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dobo-design-ia.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <h2 style={{ textAlign: "center" }}>DOBO – Prototipo IA</h2>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 300px", border: "1px solid #ccc", padding: 10, borderRadius: 12 }}>
          <h4 style={{ textAlign: "center" }}>Maceta</h4>
          <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
            <button onClick={prevMaceta}>◀</button>
            <img src={macetaActual.img} style={{ width: 100 }} />
            <button onClick={nextMaceta}>▶</button>
          </div>
        </div>

        <div style={{ flex: "1 1 300px", border: "1px solid #ccc", padding: 10, borderRadius: 12 }}>
          <h4 style={{ textAlign: "center" }}>Planta</h4>
          <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
            <button onClick={prevPlanta}>◀</button>
            <img src={plantaActual.img} style={{ width: 100 }} />
            <button onClick={nextPlanta}>▶</button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 30, textAlign: "center" }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={600}
          style={{
            width: "100%",
            maxWidth: 600,
            background: "#fafafa",
            borderRadius: 12,
          }}
        ></canvas>
      </div>

      <div style={{ marginTop: 20 }}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe el diseño que quieres..."
          style={{
            width: "100%",
            padding: 10,
            minHeight: 80,
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        ></textarea>
        <button
          onClick={handleGenerateIA}
          disabled={isGenerating}
          style={{
            marginTop: 10,
            padding: "8px 20px",
            background: "#222",
            color: "white",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {isGenerating ? "Generando..." : "Generar diseño IA"}
        </button>
      </div>

      <div style={{ marginTop: 30, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={exportPNGComplete}>Exportar PNG composición</button>
        <button onClick={exportPNGDesign}>Exportar PNG diseño IA</button>
        <button onClick={exportSVGDesign}>Exportar SVG diseño IA</button>
      </div>
    </div>
  );
}
