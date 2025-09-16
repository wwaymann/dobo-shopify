const ADMIN_API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION || '2024-10';

function pickEnv() {
  const token = process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ADMIN_API_TOKEN;
  const shop  = process.env.SHOPIFY_SHOP_DOMAIN || process.env.SHOPIFY_SHOP || process.env.SHOP_DOMAIN || '';
  const url   = process.env.SHOPIFY_ADMIN_API_URL || (shop ? `https://${shop}/admin/api/${ADMIN_API_VERSION}/graphql.json` : '');
  return { token, url, shop };
}

async function shopify(query, variables) {
  const { token, url } = pickEnv();
  const r = await fetch(url, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  const text = await r.text();
  let json=null; try { json=JSON.parse(text); } catch {}
  return { status:r.status, json, raw:text };
}

const Q_SCOPES = `query { currentAppInstallation { accessScopes { handle } } }`;
const Q_VARIANT = `query($id:ID!){ productVariant(id:$id){ id product{ id handle } } }`;
const toGid = (k,id)=>String(id||'').startsWith('gid://')?String(id):`gid://shopify/${k}/${id}`;

export default async function handler(req,res){
  try{
    const { token, shop } = pickEnv();
    if(!token) return res.status(400).json({ ok:false, error:'env-missing' });

    const scopes = await shopify(Q_SCOPES, {});
    const variantParam = req.query.variant || '';
    let variant=null;
    if (variantParam) variant = await shopify(Q_VARIANT, { id: toGid('ProductVariant', variantParam) });

    res.status(200).json({
      ok:true,
      shop,
      scopes: scopes?.json?.data?.currentAppInstallation?.accessScopes?.map(s=>s.handle) || [],
      variantLookup: variantParam ? { status: variant?.status, body: variant?.json || variant?.raw } : null
    });
  }catch(e){
    res.status(500).json({ ok:false, error:String(e) });
  }
}
