// pages/api/products.js

export default async function handler(req, res) {
  const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const storefrontAccessToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

  if (!domain || !storefrontAccessToken) {
    return res.status(500).json({ error: "Faltan variables de entorno" });
  }

  const endpoint = `https://${domain}/api/2023-04/graphql.json`;

  const query = `
    {
      products(first: 20) {
        edges {
          node {
            id
            title
            handle
            description
            images(first: 1) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            variants(first: 1) {
              edges {
                node {
                  price {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": storefrontAccessToken,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return res.status(500).json({ error: "Shopify API error", details: errorData });
    }

    const json = await response.json();

    const products = json?.data?.products?.edges?.map(edge => edge.node) || [];
    return res.status(200).json(products);
  } catch (error) {
    return res.status(500).json({ error: "Server error", details: error.message });
  }
}

