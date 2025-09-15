export default async function handler(req,res){
  try{
    const d=process.env.SHOPIFY_STORE_DOMAIN, t=process.env.SHOPIFY_ADMIN_API_TOKEN;
    if(!d||!t) return res.status(200).json({adminToken:false});
    const r=await fetch(`https://${d}/admin/api/2024-07/graphql.json`,{
      method:'POST',
      headers:{'X-Shopify-Access-Token':t,'Content-Type':'application/json'},
      body:JSON.stringify({query:'{ shop { name id } }'})
    });
    const j=await r.json();
    return res.status(200).json({adminToken:r.ok && !j.errors, shop:j?.data?.shop||null});
  }catch(e){return res.status(500).json({error:String(e)})}
}
