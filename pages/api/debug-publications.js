const ADMIN_VER='2024-07';
export default async function h(req,res){
  try{
    const shop=process.env.SHOPIFY_SHOP, at=process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    if(!shop||!at) return res.status(500).json({error:'Missing env'});
    const r=await fetch(`https://${shop}/admin/api/${ADMIN_VER}/graphql.json`,{
      method:'POST',
      headers:{'X-Shopify-Access-Token':at,'Content-Type':'application/json'},
      body:JSON.stringify({query:`{ publications(first:50){ nodes{ id name } } }`})
    });
    const j=await r.json();
    res.status(200).json(j?.data?.publications?.nodes||[]);
  }catch(e){res.status(500).json({error:e.message});}
}
