// pages/api/design-product.js
export const runtime = 'nodejs';
export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

// --- Admin API version (override with env if needed)
const ADMIN_VER = process.env.SHOPIFY_ADMIN_API_VERSION || '2025-07';

/* ================= env ================= */
function pickEnv() {
  const token =
    process.env.SHOPIFY_ADMIN_TOKEN ||
    process.env.SHOPIFY_ADMIN_API_TOKEN || '';
  const shop =
    process.env.SHOPIFY_SHOP ||
    process.env.SHOPIFY_SHOP_DOMAIN ||
    process.env.SHOP_DOMAIN || '';
  const publicationId = process.env.SHOPIFY_PUBLICATION_ID || '';
  const url = shop ? `https://${shop}/admin/api/${ADMIN_VER}/graphql.json` : '';
  return { token, shop, url, publicationId };
}

/* ================ fetch ================ */
async function shopifyFetch(query, variables) {
  const { token, url } = pickEnv();
  if (!token || !url) {
    const e = new Error('env-missing'); e.stage = 'env'; throw e;
  }
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch {}
  if (!r.ok || !j || j.errors) {
    console.error('GRAPHQL_ERROR', { status: r.status, body: text });
    const e = new Error('shopify-graphql-error');
    e.stage = 'graphql';
    e.details = { status: r.status, body: text };
    throw e;
  }
  return j.data;
}

/* ================ GQL ================== */
const GQL_PRODUCT_CREATE =
  "mutation productCreate($input: ProductInput!) { productCreate(input: $input) { product { id handle variants(first:1) { nodes { id } } } userErrors { field message } } }";

const GQL_PUBLISH =
  "mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { field message } } }";

/* =============== helpers =============== */
const toMoney = (n) => {
  const v = Number(n || 0);
  return v.toFixed(2); // Shopify espera string con 2 decimales
};

/* ================ handler =============== */
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method-not-allowed' });

    // Env requeridas para este endpoint
    const REQUIRED = ['SHOPIFY_SHOP','SHOPIFY_ADMIN_TOKEN','SHOPIFY_PUBLICATION_ID'];
    const missing = REQUIRED.filter(n => !process.env[n] || String(process.env[n]).trim()==='');
    if (missing.length) return res.status(400).json({ ok:false, error:'env-missing', missing });

    const { publicationId } = pickEnv();

    // Payload mínimo desde el front
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const {
      quantity = 1,
      attributes = [],         // array de { key, value } (lo devuelves al front; Shopify no lo usa aquí)
      basePrice = 0,
      plantTitle = 'Planta',
      potTitle = 'Maceta'
    } = body;

    const title = `${potTitle} + ${plantTitle}`.trim();
    const price = toMoney(basePrice);

    // 1) Crear producto con 1 variante y precio
    const create = await shopifyFetch(GQL_PRODUCT_CREATE, {
      input: {
        title,
        status: 'DRAFT',
        variants: [{ price, requiresShipping: true }],
        // opcional: tags para rastrear
        tags: ['DOBO', 'custom-design']
      }
    });

    const uerr = create?.productCreate?.userErrors || [];
    if (uerr.length) {
      return res.status(400).json({ ok:false, error:'productCreate-errors', details:uerr });
    }

    const productId = create?.productCreate?.product?.id || null;
    const handle    = create?.productCreate?.product?.handle || '';
    const variantId = create?.productCreate?.product?.variants?.nodes?.[0]?.id || null;

    if (!productId || !variantId) {
      return res.status(500).json({ ok:false, error:'missing-product-or-variant' });
    }

    // 2) Publicar en el canal indicado por env
    const pubRes = await shopifyFetch(GQL_PUBLISH, {
      id: productId,
      input: [{ publicationId }]
    });
    const pubErr = pubRes?.publishablePublish?.userErrors || [];
    if (pubErr.length) {
      // no bloqueamos: devolvemos variante igualmente
      console.warn('publishablePublish userErrors', pubErr);
    }

    // Devuelve datos esenciales al front
    return res.status(200).json({
      ok: true,
      variantId,        // GID de la variante creada
      productId,        // GID del producto
      handle,           // para debug
      // eco opcional
      title,
      price,
      quantity,
      attributes
    });

  } catch (err) {
    const code = err?.stage === 'env' ? 400 : 500;
    return res.status(code).json({
      ok:false,
      error:String(err?.message||err||'error'),
      stage:err?.stage||null,
      details:err?.details||null,
    });
  }
}
