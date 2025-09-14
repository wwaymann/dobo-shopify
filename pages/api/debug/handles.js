export default async function handler(req, res) {
  try {
    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const token  = process.env.SHOPIFY_STOREFRONT_API_TOKEN;
    if (!domain || !token) return res.status(200).json({ error: 'env-missing' });

    const query = `query { products(first:50) { edges { node { handle } } } }`;
    const r = await fetch(`https://${domain}/api/2024-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token
      },
      body: JSON.stringify({ query })
    });
    const j = await r.json();
    const handles = j?.data?.products?.edges?.map(e => e.node.handle) || [];
    res.status(200).json(handles);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
}
