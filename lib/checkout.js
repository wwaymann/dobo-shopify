
export const toGid=(id)=>{const s=String(id||"");if(s.startsWith("gid://"))return s;return `gid://shopify/ProductVariant/${s.replace(/\D/g,"")}`};
export async function cartCreateAndRedirect(lines, cartAttributes=[]){
  const r=await fetch("/api/cart-create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lines,attributes:cartAttributes})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j?.checkoutUrl) throw new Error(j?.error||"cart-create-failed");
  if(typeof window!=="undefined"&&window.top) window.top.location.href=j.checkoutUrl; else window.location.href=j.checkoutUrl;
}
