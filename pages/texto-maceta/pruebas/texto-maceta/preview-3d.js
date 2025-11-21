// /pages/preview-3d.js
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { normalMapFromImage } from "../lib/normalMap";

const PotViewer = dynamic(()=>import("../components/three/PotViewer"), { ssr:false });

export default function Preview3D(){
  const [nmUrl, setNmUrl] = useState(null);

  useEffect(()=>{
    const logoSrc = "/logo-dobo.png"; // asegúrate de subir este archivo a /public
    normalMapFromImage(logoSrc, { size:1024, blurPx:8, strength:2.0 })
      .then(u => { console.log("nmUrl len", u.length); setNmUrl(u); })
      .catch(e => { console.error("NM fail", e); });
  },[]);

  if(!nmUrl) return <p style={{padding:16}}>Generando normal map…</p>;
  return <PotViewer normalUrl={nmUrl} />;
}
