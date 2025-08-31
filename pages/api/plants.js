// pages/api/plants.js
export default async function handler(req, res) {
  try {
    const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
    const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
    const TOKEN =
      process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;

    if (!STORE_DOMAIN || !TOKEN) {
      return res.status(500).json({ error: 'missing_shopify_env' });
    }

    const r = await fetch(`https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': TOKEN,
      },
      body: JSON.stringify({
        query: `
          {
            products(first: 100, query: "tag:plantas") {
              edges {
                node {
                  id
                  title
                  images(first: 1) { edges { node { url } } }
                }
              }
            }
          }
        `,
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: 'shopify_error', detail: text });
    }

    const json = await r.json();
    const items =
      json?.data?.products?.edges?.map(({ node }) => ({
        id: node.id,
        title: node.title,
        image: node.images?.edges?.[0]?.node?.url || '',
      })) || [];

    res.status(200).json(items);
  } catch (err) {
    console.error('Error /api/plants:', err);
    res.status(500).json({ error: 'server_error' });
  }
}
