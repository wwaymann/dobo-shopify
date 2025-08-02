export default async function handler(req, res) {
  const response = await fetch(`https://${process.env.SHOPIFY_STORE_DOMAIN}/api/2023-04/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN,
    },
    body: JSON.stringify({
      query: `
        {
          products(first: 20) {
            edges {
              node {
                id
                title
                images(first: 1) {
                  edges {
                    node {
                      url
                    }
                  }
                }
              }
            }
          }
        }
      `
    }),
  });

  const json = await response.json();
  const products = json.data.products.edges.map(edge => edge.node);
  res.status(200).json(products);
}