// Página de prueba cliente. Sin SSR.
'use client';

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { applyRelief2DFromURLs } from "../lib/relief2d";

function Preview2D(){
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const out = await applyRelief2DFromURLs(
          "/pot.jpg",        // /public/pot.jpg
          "/logo-dobo.png",  // /public/logo-dobo.png (blanco, fondo transparente)
          {
            logoScaleW: 0.36,
            logoCenter: [0.48, 0.46],
            strength: 3.4,
            light: [-0.95, -0.55, 0.30],
            ao: 0.22,
            cylK: 0.40,
            cylCX: 0.50
          }
        );
        setUrl(out);
      } catch (e) {
        console.error("relief2D fail:", e);
        setErr(String(e));
      }
    })();
  }, []);

  if (err) return <pre style={{padding:16,color:"#f55"}}>{err}</pre>;
  if (!url) return <p style={{padding:16}}>Procesando…</p>;

  return (
    <div style={{padding:16, background:"#1f1f1f", minHeight:"100vh"}}>
      <img src={url} alt="Relieve 2D" style={{maxWidth:"100%", height:"auto"}}/>
      <div style={{marginTop:12}}><a href={url} download="dobo-relieve-2d.png">Descargar PNG</a></div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(Preview2D), { ssr: false });
