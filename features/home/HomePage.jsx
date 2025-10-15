
import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { cartCreateAndRedirect, toGid } from "../../lib/checkout";
import { getShopDomain } from "../../lib/shopDomain";
const CustomizationOverlay = dynamic(() => import("../../components/CustomizationOverlay").catch(() => () => null), { ssr: false });

async function capturePreviewFallback(stageEl){
  try{ const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(stageEl||document.body,{ backgroundColor:"#fff", scale:2, useCORS:true, willReadFrequently:true });
    return canvas.toDataURL("image/png");
  }catch{return ""}
}

export default function HomePage(){
  const [activeSize, setActiveSize] = useState("Mediano");
  const [selectedColor, setSelectedColor] = useState("Cemento");
  const [quantity, setQuantity] = useState(1);

  const [pots,setPots] = useState([{id:"1", title:"Maceta", variants:[{id:"gid://shopify/ProductVariant/1", price:{amount:10000}}]}]);
  const [plants,setPlants] = useState([{id:"2", title:"Planta", minPrice:{amount:5000}}]);
  const [selectedPotIndex,setSelectedPotIndex]=useState(0);
  const [selectedPlantIndex,setSelectedPlantIndex]=useState(0);
  const stageRef = useRef(null);

  const selectedProduct = pots[selectedPotIndex]||{};
  const selectedVariant = useMemo(()=>selectedProduct?.variants?.[0]||null,[selectedProduct]);

  const totalNow = useMemo(()=>{
    const potPrice = Number(selectedVariant?.price?.amount??selectedVariant?.price??0);
    const plantPrice = Number(plants?.[selectedPlantIndex]?.minPrice?.amount??plants?.[selectedPlantIndex]?.minPrice??0);
    return (potPrice+plantPrice)*quantity;
  },[selectedVariant, plants, selectedPlantIndex, quantity]);

  async function prepareDesignAttributes(){
    const previewUrl = await capturePreviewFallback(stageRef.current);
    const pot=pots[selectedPotIndex]; const plant=plants[selectedPlantIndex];
    return [
      { key:"_DesignPreview", value: previewUrl },
      { key:"_DesignId", value:`dobo-${Date.now()}`},
      { key:"_DesignPlant", value:plant?.id||""},
      { key:"_DesignPot", value:pot?.id||""},
      { key:"_DesignColor", value:selectedColor||""},
      { key:"_DesignSize", value:activeSize||""},
      { key:"_LinePriority", value:"0" },
    ];
  }

  async function buyNow(){
    try{
      const attrs = await prepareDesignAttributes();
      const previewUrl = attrs.find(a=>a.key==="_DesignPreview")?.value||"";
      const designId = attrs.find(a=>a.key==="_DesignId")?.value||`dobo-${Date.now()}`;

      const resp = await fetch("/api/design-product",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        title:`DOBO ${plants[selectedPlantIndex]?.title||""} + ${pots[selectedPotIndex]?.title||""}`,
        previewUrl, price: Number(totalNow/Math.max(1,quantity)),
        color:selectedColor, size:activeSize, designId,
        plantTitle:plants[selectedPlantIndex]?.title||"Planta",
        potTitle:pots[selectedPotIndex]?.title||"Maceta",
        shortDescription:`DOBO personalizado: ${plants[selectedPlantIndex]?.title||"Planta"} + ${pots[selectedPotIndex]?.title||"Maceta"} • Color ${selectedColor} • Tamaño ${activeSize}`,
      })});
      const dp = await resp.json().catch(()=>({}));
      if(!resp.ok||!dp?.variantId){ console.warn("Admin falló; usando fallback a variante"); }

      const variantGid = dp?.variantId || (selectedVariant?.id?String(selectedVariant.id):null);
      if(!variantGid) throw new Error("variant-missing");

      const lines=[{ quantity, merchandiseId: variantGid.startsWith("gid://")?variantGid:toGid(variantGid), attributes: attrs.map(a=>({key:a.key.replace(/^_/,""), value:String(a.value||"")})) }];
      await cartCreateAndRedirect(lines, [{key:"designId", value:designId}]);
    }catch(e){ alert(`No se pudo iniciar el checkout: ${e?.message||e}`); }
  }

  return (
    <div style={{maxWidth:1100,margin:"0 auto",padding:16}}>
      <div ref={stageRef} style={{border:"1px dashed #aaa",borderRadius:12,minHeight:320,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{textAlign:"center"}}>
          <h2>DOBO</h2>
          <p>{plants[selectedPlantIndex]?.title||"Planta"} + {pots[selectedPotIndex]?.title||"Maceta"}</p>
        </div>
      </div>
      <div style={{display:"flex",gap:24,marginTop:24,alignItems:"center"}}>
        <div style={{fontSize:28,fontWeight:700}}>${Math.round(totalNow).toLocaleString("es-CL")}</div>
        <button onClick={buyNow} style={{padding:"10px 16px",borderRadius:8,border:"1px solid #111",background:"#111",color:"#fff"}}>Comprar ahora</button>
      </div>
    </div>
  );
}
