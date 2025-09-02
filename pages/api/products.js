// pages/api/products.js
export default async function handler(req, res) {
  const STORE_DOMAIN =
    process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
  const TOKEN =
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;

  let items = [];
  try {
    if (!STORE_DOMAIN || !TOKEN) return res.status(200).json(items);

    const r = await fetch(`https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': TOKEN,
      },
      body: JSON.stringify({
        query: `
          {
            products(first: 200) {
              edges {
                node {
                  id
                  title
                  handle
                  tags
                  priceRange {
                    minVariantPrice { amount currencyCode }
                  }
                  images(first: 4) { edges { node { url } } }
                  variants(first: 25) {
                    edges {
                      node {
                        id
                        title
                        availableForSale
                        image { url }
                        price { amount currencyCode }
                        selectedOptions { name value }
                      }
                    }
                  }
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
    const edges = json?.data?.products?.edges || [];
    items = edges.map(({ node }) => ({
      id: node.id,
      title: node.title,
      handle: node.handle,
      tags: Array.isArray(node.tags) ? node.tags : [],
      image: node.images?.edges?.[0]?.node?.url || '',
      images: (node.images?.edges || []).map(e => e?.node?.url).filter(Boolean),
      minPrice: {
        amount: Number(node.priceRange?.minVariantPrice?.amount || 0),
        currencyCode: node.priceRange?.minVariantPrice?.currencyCode || 'CLP',
      },
      variants: (node.variants?.edges || []).map(e => ({
        id: e?.node?.id,
        title: e?.node?.title,
        availableForSale: !!e?.node?.availableForSale,
        image: e?.node?.image?.url || '',
        price: {
          amount: Number(e?.node?.price?.amount || 0),
          currencyCode: e?.node?.price?.currencyCode || 'CLP',
        },
        options: (e?.node?.selectedOptions || []).map(o => ({ name: o.name, value: o.value })),
      })),
    }));

    return res.status(200).json(items);
  } catch (e) {
    console.error('Error /api/products', e);
    return res.status(200).json(items);
  }
}
