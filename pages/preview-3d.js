import DebugBoundary from "../components/DebugBoundary";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { normalMapFromImage } from "../lib/normalMap";

const PotViewer = dynamic(()=>import("../components/three/PotViewer"), { ssr:false });

export default function Preview3D(){
  const [nmUrl, setNmUrl] = useState(null);

  useEffect(()=>{
    // Usa tu logo en /public (SVG o PNG monocromo)
    const logoSrc = "/logo-dobo.png"; // o "/logo-dobo.svg"
    normalMapFromImage(logoSrc, { size:1024, blurPx:8, strength:2.0 })
      .then(setNmUrl)
      .catch(console.error);
  },[]);

  if(!nmUrl) return <p style={{padding:16}}>Generando normal map…</p>;
  return <PotViewer normalUrl={nmUrl} />;
return <DebugBoundary><PotViewer normalUrl={nmUrl}/></DebugBoundary>;
}
