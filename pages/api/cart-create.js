
export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try{
    const {lines=[],attributes=[]}=req.body||{};
    const domain=process.env.SHOPIFY_SHOP||process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN||process.env.NEXT_PUBLIC_SHOP_DOMAIN;
    const token=process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN||process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;
    if(!domain||!token) return res.status(500).json({error:"missing-storefront-env"});
    const endpoint=`https://${domain}/api/2024-07/graphql.json`;
    const mutation=`mutation CartCreate($input: CartInput!){cartCreate(input:$input){cart{id checkoutUrl} userErrors{field message}}}`;
    const input={lines:lines.map(l=>({quantity:Number(l.quantity||1), merchandiseId:String(l.merchandiseId||""), attributes:(l.attributes||[]).map(a=>({key:String(a.key||""), value:String(a.value||"")}))})), attributes:(attributes||[]).map(a=>({key:String(a.key||""), value:String(a.value||"")}))};
    const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","X-Shopify-Storefront-Access-Token":token},body:JSON.stringify({query:mutation,variables:{input}})});
    const j=await r.json(); const err=j?.errors?.[0]?.message||j?.data?.cartCreate?.userErrors?.[0]?.message; const url=j?.data?.cartCreate?.cart?.checkoutUrl;
    if(!url) return res.status(500).json({error:err||"no-checkoutUrl"}); return res.status(200).json({checkoutUrl:url});
  }catch(e){return res.status(500).json({error:String(e?.message||e)})}
}
