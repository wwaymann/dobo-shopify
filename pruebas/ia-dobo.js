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
  const [designUrl, setDesignUrl] = useState(null); // diseño IA (PNG)
  const [isGenerating, setIsGenerating] = useState(false);

  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const designObjectRef = useRef(null);

  // ----------- NAVEGACIÓN CARRUSELES -----------

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

  // ----------- SETUP DE CANVAS CON FABRIC -----------

  useEffect(() => {
    let isCancelled = false;

    async function setupCanvas() {
      const canvasElement = canvasRef.current;
      if (!canvasElement) return;

      // Import dinámico de fabric (solo en cliente)
      const fabricModule = await import("fabric");
      const fabric = fabricModule.fabric || fabricModule.default || fabricModule;

      // Destruye el canvas anterior si existe
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }

      const canvas = new fabric.Canvas(canvasElement, {
        backgroundColor: "#f5f5f5",
        selection: false,
      });
      fabricCanvasRef.current = canvas;

      const width = canvas.getWidth();
      const height = canvas.getHeight();

      // Helper para cargar imagen como promise
      const loadImage = (url) =>
        new Promise((resolve, reject) => {
          fabric.Image.fromURL(
            url,
            (img) => {
              if (!img) {
                reject(new Error("No se pudo cargar la imagen: " + url));
              } else {
                resolve(img);
              }
            },
            { crossOrigin: "anonymous" }
          );
        });

      try {
        // 1) Maceta (base)
        const macetaImg = await loadImage(macetaActual.img);
        const macetaScale =
          (width * 0.7) / macetaImg.width; // maceta ocupa 70% del ancho
        macetaImg.set({
          left: width / 2,
          top: height * 0.6,
          originX: "center",
          originY: "center",
          selectable: false,
        });
        macetaImg.scale(macetaScale);
        canvas.add(macetaImg);

        // 2) Planta (encima de la maceta)
        const plantaImg = await loadImage(plantaActual.img);
        const plantaScale =
          (width * 0.6) / plantaImg.width; // un poco más pequeña
        plantaImg.set({
          left: width / 2,
          top: height * 0.25,
          originX: "center",
          originY: "center",
          selectable: false,
        });
        plantaImg.scale(plantaScale);
        canvas.add(plantaImg);

        // 3) Diseño IA (superpuesto en el frente de la maceta)
        if (designUrl) {
          const designImg = await loadImage(designUrl);

          // Lo colocamos centrado sobre la "panza" de la maceta
          const designScale =
            (width * 0.45) / designImg.width; // 45% del ancho
          designImg.set({
            left: width / 2,
            top: height * 0.62,
            originX: "center",
            originY: "center",
            selectable: true,
            hasBorders: true,
            hasControls: true,
          });
          designImg.scale(designScale);
          canvas.add(designImg);
          designObjectRef.current = designImg;
          canvas.setActiveObject(designImg);
        } else {
          designObjectRef.current = null;
        }

        canvas.renderAll();
      } catch (error) {
        console.error("Error al cargar imágenes en el canvas:", error);
      }
    }

    if (!isCancelled) {
      setupCanvas();
    }

    return () => {
      isCancelled = true;
    };
  }, [macetaIndex, plantaIndex, designUrl, macetaActual.img, plantaActual.img]);

  // ----------- SIMULACIÓN DE GENERACIÓN IA -----------

  const handleGenerateIA = async () => {
    if (!prompt.trim()) {
      alert("Escribe una descripción para el diseño primero.");
      return;
    }

    setIsGenerating(true);

    // Por ahora usamos una imagen dummy en /public
    // Coloca por ejemplo: /public/demo-design.png
    // Luego conectamos esto a tu API real de OpenAI.
    setTimeout(() => {
      setDesignUrl("/demo-design.png");
      setIsGenerating(false);
    }, 1500);
  };

  // ----------- EXPORTS -----------

  const downloadDataUrl = (dataUrl, filename) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  const handleExportPNGComposicion = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL({
      format: "png",
      multiplier: 2, // más resolución
    });
    downloadDataUrl(dataUrl, "dobo-composicion.png");
  };

  const handleExportPNGDiseno = () => {
    const design = designObjectRef.current;
    if (!design) {
      alert("No hay diseño IA aplicado aún.");
      return;
    }

    // Creamos un canvas temporal solo con el diseño
    import("fabric").then((fabricModule) => {
      const fabric =
        fabricModule.fabric || fabricModule.default || fabricModule;

      const tempCanvas = new fabric.Canvas(document.createElement("canvas"), {
        width: design.getScaledWidth(),
        height: design.getScaledHeight(),
      });

      const cloned = fabric.util.object.clone(design);
      cloned.set({
        left: tempCanvas.getWidth() / 2,
        top: tempCanvas.getHeight() / 2,
        originX: "center",
        originY: "center",
      });
      tempCanvas.add(cloned);
      tempCanvas.renderAll();

      const dataUrl = tempCanvas.toDataURL({
        format: "png",
        multiplier: 2,
      });
      downloadDataUrl(dataUrl, "dobo-diseno-ia.png");
      tempCanvas.dispose();
    });
  };

  const handleExportSVGDiseno = () => {
    const design = designObjectRef.current;
    if (!design) {
      alert("No hay diseño IA aplicado aún.");
      return;
    }

    const svgString = design.toSVG();
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "dobo-diseno-ia.svg";
    a.click();

    URL.revokeObjectURL(url);
  };

  // ----------- RENDER -----------

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        alignItems: "center",
        boxSizing: "border-box",
      }}
    >
      <h2 style={{ textAlign: "center" }}>DOBO – Prototipo IA</h2>

      {/* CONTENEDOR PRINCIPAL RESPONSIVO */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          width: "100%",
          maxWidth: 1100,
        }}
      >
        {/* Carruseles arriba (stack en mobile) */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 20,
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          {/* CARRUSEL MACETA */}
          <div
            style={{
              flex: "1 1 250px",
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <h4 style={{ marginTop: 0, textAlign: "center" }}>Maceta</h4>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <button onClick={prevMaceta}>◀</button>
              <div style={{ textAlign: "center" }}>
                <img
                  src={macetaActual.img}
                  alt={macetaActual.name}
                  style={{
                    width: 100,
                    height: 100,
                    objectFit: "contain",
                    display: "block",
                    margin: "0 auto",
                  }}
                />
                <small>{macetaActual.name}</small>
              </div>
              <button onClick={nextMaceta}>▶</button>
            </div>
          </div>

          {/* CARRUSEL PLANTA */}
          <div
            style={{
              flex: "1 1 250px",
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <h4 style={{ marginTop: 0, textAlign: "center" }}>Planta</h4>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <button onClick={prevPlanta}>◀</button>
              <div style={{ textAlign: "center" }}>
                <img
                  src={plantaActual.img}
                  alt={plantaActual.name}
                  style={{
                    width: 100,
                    height: 100,
                    objectFit: "contain",
                    display: "block",
                    margin: "0 auto",
                  }}
                />
                <small>{plantaActual.name}</small>
              </div>
              <button onClick={nextPlanta}>▶</button>
            </div>
          </div>
        </div>

        {/* Centro: Canvas + Prompt IA */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Lienzo de composición */}
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 10,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <canvas
              ref={canvasRef}
              width={600}
              height={600}
              style={{
                width: "100%",
                maxWidth: 600,
                height: "auto",
                background: "#fafafa",
                borderRadius: 12,
              }}
            />
          </div>

          {/* Prompt estilo chat + botón IA */}
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <label style={{ fontSize: 14, opacity: 0.8 }}>
              Describe el diseño que quieres generar:
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                "Ej: Diseño para el Día de la Madre para Juanita, flores suaves, estilo acuarela."
              }
              style={{
                width: "100%",
                minHeight: 80,
                padding: 10,
                borderRadius: 8,
                border: "1px solid #ccc",
                resize: "vertical",
              }}
            />
            <button
              onClick={handleGenerateIA}
              disabled={isGenerating}
              style={{
                alignSelf: "flex-end",
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: isGenerating ? "#999" : "#222",
                color: "white",
                cursor: isGenerating ? "default" : "pointer",
              }}
            >
              {isGenerating ? "Generando diseño..." : "Generar diseño con IA"}
            </button>
          </div>
        </div>

        {/* Exportaciones */}
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 12,
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: "center",
          }}
        >
          <button onClick={handleExportPNGComposicion}>
            Exportar PNG composición completa
          </button>
          <button on
