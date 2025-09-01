// pages/api/products.js
export default async function handler(req, res) {
  const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const API_VERSION  = process.env.SHOPIFY_API_VERSION || '2025-01';
  const TOKEN =
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;

  let items = []; // siempre devolveremos un array

  try {
    if (!STORE_DOMAIN || !TOKEN) {
      console.error('Missing Shopify envs');
      return res.status(200).json(items);
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
            products(first: 100) {
              edges {
                node {
                  id
                  title
                  handle
                  images(first: 1) { edges { node { url } } }
                }
              }
            }
          }
        `,
      }),
    });

    if (!r.ok) {
      console.error('Shopify error', await r.text());
      return res.status(200).json(items);
    }

    const json = await r.json();
    const edges = json?.data?.products?.edges;

    if (Array.isArray(edges)) {
      items = edges.map(({ node }) => ({
        id: node.id,
        title: node.title,
        handle: node.handle,
        image: node.images?.edges?.[0]?.node?.url || '',
      }));
    }

    return res.status(200).json(items);
  } catch (e) {
    console.error('Error /api/products', e);
    return res.status(200).json(items);
  }
}
