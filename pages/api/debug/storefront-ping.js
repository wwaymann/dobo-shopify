import { SHOP_DOMAIN, STOREFRONT_TOKEN } from '../../lib/shopifyEnv';
export default async function handler(_, res){
  try{
    const q = `query{ shop{name primaryDomain{url}} }`;
    const r = await fetch(`https://${SHOP_DOMAIN}/api/2024-07/graphql.json`,{
      method:'POST',
      headers:{'Content-Type':'application/json','X-Shopify-Storefront-Access-Token':STOREFRONT_TOKEN},
      body: JSON.stringify({query:q})
    });
    const j = await r.json();
    res.status(r.ok?200:400).json({ok:r.ok, data:j});
  }catch(e){ res.status(500).json({ok:false, error:e.message}); }
}
