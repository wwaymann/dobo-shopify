// pages/api/debug/variants.js
export const runtime = 'nodejs';

const ADMIN_API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION || '2024-10';

function pickEnv() {
  const token =
    process.env.SHOPIFY_ADMIN_TOKEN ||
    process.env.SHOPIFY_ADMIN_API_TOKEN;
  const shop =
    process.env.SHOPIFY_SHOP_DOMAIN ||
    process.env.SHOPIFY_SHOP ||
    process.env.SHOP_DOMAIN ||
    '';
  const url =
    process.env.SHOPIFY_ADMIN_API_URL ||
    (shop ? `https://${shop}/admin/api/${ADMIN_API_VERSION}/graphql.json` : '');
  return { token, url, shop };
}

async function shopifyFetch(query, variables) {
  const { token, url } = pickEnv();
  if (!token || !url) return { status:400, json:{ errors:['env-missing'] } };
  const r = await fetch(url, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status:r.status, json, raw:text };
}

const Q_BY_HANDLE = `
query($handle:String!){
  productByHandle(handle:$handle){
    id handle title
    variants(first:100){ edges{ node{ id title sku } } }
  }
}`;
const Q_LIST = `
query($first:Int!,$after:String){
  products(first:$first, after:$after){
    edges{
      cursor
      node{
        id handle title
        variants(first:50){ edges{ node{ id title sku } } }
      }
    }
    pageInfo{ hasNextPage endCursor }
  }
}`;

export default async function handler(req,res){
  const handle = (req.query.handle || '').trim();
  try{
    if (handle) {
      const r = await shopifyFetch(Q_BY_HANDLE, { handle });
      const p = r.json?.data?.productByHandle || null;
      return res.status(200).json({
        ok:true,
        mode:'by-handle',
        handle,
        product: p ? {
          id: p.id, handle: p.handle, title: p.title,
          variants: (p.variants?.edges||[]).map(e=>e.node)
        } : null
      });
    }
    const first = Math.min(50, Math.max(1, parseInt(req.query.first||'20',10) || 20));
    const after = req.query.after || null;
    const r = await shopifyFetch(Q_LIST, { first, after });
    const data = r.json?.data?.products || { edges:[], pageInfo:{ hasNextPage:false, endCursor:null } };
    const items = (data.edges||[]).map(e => ({
      id: e.node.id, handle: e.node.handle, title: e.node.title,
      variants: (e.node.variants?.edges||[]).map(v=>v.node)
    }));
    return res.status(200).json({
      ok:true,
      mode:'list',
      items,
      pageInfo: data.pageInfo || { hasNextPage:false, endCursor:null }
    });
  }catch(e){
    return res.status(500).json({ ok:false, error:String(e) });
  }
}
