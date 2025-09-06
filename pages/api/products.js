// pages/api/products.js
export default async function handler(req, res) {
  try {
    const domain = process.env.SHOPIFY_STORE_DOMAIN;          // p.ej. um7xus-0u.myshopify.com
    const version = process.env.SHOPIFY_API_VERSION || '2025-01';
    const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

    const query = `
      query {
        products(first: 100) {
          edges {
            node {
              id
              title
              tags
              description
              descriptionHtml
              images(first: 1) {
                edges { node { url originalSrc src altText } }
              }
              priceRange {
                minVariantPrice { amount currencyCode }
              }
              variants(first: 100) {
                edges {
                  node {
                    id
                    availableForSale
                    selectedOptions { name value }
                    image { url originalSrc src }
                    price { amount currencyCode }
                    compareAtPrice { amount currencyCode }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const resp = await fetch(`https://${domain}/api/${version}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({ query }),
    });

    const json = await resp.json();
    if (!resp.ok || json.errors) {
      return res.status(401).json({ ok:false, reason:'shopify_error', detail: JSON.stringify(json) });
    }

    const products = (json.data?.products?.edges ?? []).map(({ node }) => ({
      id: node.id,
      title: node.title,
      tags: node.tags || [],
      description: node.descriptionHtml || node.description || "",
      image:
        node.images?.edges?.[0]?.node?.url ||
        node.images?.edges?.[0]?.node?.originalSrc ||
        node.images?.edges?.[0]?.node?.src ||
        "",
      minPrice: node.priceRange?.minVariantPrice || { amount: 0, currencyCode: 'CLP' },
      variants: (node.variants?.edges ?? []).map(({ node: v }) => ({
        id: v.id,
        availableForSale: v.availableForSale,
        selectedOptions: v.selectedOptions || [],
        image: v.image?.url || v.image?.originalSrc || v.image?.src || "",
        price: v.price || { amount: 0, currencyCode: 'CLP' },
        compareAtPrice: v.compareAtPrice || null,
      })),
    }));

    res.status(200).json(products);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'api_products_failed' });
  }
}
