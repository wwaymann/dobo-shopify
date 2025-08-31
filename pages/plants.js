// pages/api/plants.js
export default async function handler(req, res) {
  try {
    const STORE_DOMAIN =
      process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_DOMAIN;
    const TOKEN =
      process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN ||
      process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

    if (!STORE_DOMAIN || !TOKEN) {
      return res.status(500).json({ error: 'missing_shopify_env' });
    }

    const response = await fetch(
      `https://${STORE_DOMAIN}/api/2023-01/graphql.json`,
      {
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
                    images(first: 1) {
                      edges { node { url } }
                    }
                  }
                }
              }
            }
          `,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: 'shopify_error', detail: text });
    }

    const json = await response.json();
    const products =
      json?.data?.products?.edges?.map(({ node }) => ({
        id: node.id,
        title: node.title,
        image: node.images?.edges?.[0]?.node?.url || '',
      })) || [];

    res.status(200).json(products);
  } catch (error) {
    console.error('Error en /api/plants:', error);
    res.status(500).json({ error: 'server_error' });
  }
}
