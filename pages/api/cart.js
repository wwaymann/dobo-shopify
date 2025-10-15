// pages/api/cart.js
async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token  = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  const ver    = process.env.SHOPIFY_STOREFRONT_API_VERSION || '2024-10';

  if (!domain || !token) {
    res.status(500).json({ ok:false, error:'missing-storefront-env', domainSet:!!domain, tokenSet:!!token });
    return;
  }

  const { intent, lines = [], attributes = [] } = req.body || {};
  if (!Array.isArray(lines) || lines.length === 0) { res.status(400).json({ ok:false, error:'no-lines' }); return; }

  const endpoint = `https://${domain}/api/${ver}/graphql.json`;
  const headers = {
    'Content-Type':'application/json',
    'X-Shopify-Storefront-Access-Token': token
  };
  const CART_CREATE = `
    mutation CartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart { id checkoutUrl }
        userErrors { field message }
      }
    }`;

  try {
    const r1 = await fetch(endpoint, {
      method:'POST', headers,
      body: JSON.stringify({ query: CART_CREATE, variables: { input: { lines, attributes } } })
    });
    const j1 = await r1.json();

    if (!r1.ok || j1.errors) { res.status(500).json({ ok:false, stage:'cartCreate', errors:j1.errors || null, raw:j1 }); return; }
    const ue = j1?.data?.cartCreate?.userErrors;
    if (ue && ue.length) { res.status(500).json({ ok:false, stage:'cartCreate', userErrors: ue }); return; }

    const checkoutUrl = j1?.data?.cartCreate?.cart?.checkoutUrl;
    if (!checkoutUrl) { res.status(500).json({ ok:false, stage:'checkoutUrl-missing', raw:j1 }); return; }

    if (intent === 'cart') { res.status(200).json({ ok:true, cartId: j1.data.cartCreate.cart.id }); return; }
    res.status(200).json({ ok:true, checkoutUrl });
  } catch (e) {
    res.status(500).json({ ok:false, error:'exception', message:e?.message });
  }
}

module.exports = handler;
