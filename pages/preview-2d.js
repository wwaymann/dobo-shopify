// Cliente puro. Sin SSR.
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
const Preview2D = () => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    (async () => {
      const { applyRelief2DFromURLs } = await import("../lib/relief2d");
      const out = await applyRelief2DFromURLs(
        "/pot.jpg",
        "/logo-dobo.png",
        {
          logoScaleW: 0.36,
          logoCenter: [0.48, 0.46],
          strength: 3.2,
          light: [-0.9, -0.6, 0.35],
          ao: 0.25
        }
      );
      setUrl(out);
    })();
  }, []);
  if (!url) return <p style={{padding:16}}>Procesando…</p>;
  return (
    <div style={{padding:16, background:"#1f1f1f", minHeight:"100vh"}}>
      <img src={url} alt="Relieve 2D" style={{maxWidth:"100%", height:"auto"}}/>
      <a href={url} download="dobo-relieve-2d.png">Descargar PNG</a>
    </div>
  );
};
export default dynamic(() => Promise.resolve(Preview2D), { ssr: false });
