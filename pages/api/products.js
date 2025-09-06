// pages/api/products.js
export default async function handler(req, res) {
  try {
    const domain = process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
    const version = process.env.SHOPIFY_API_VERSION || '2025-01';
    const token =
      process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

    if (!domain || !token) {
      return res.status(200).json([]);
    }

    const { size = '', type = '', first = '50' } = req.query;

    // Construye el query de Shopify (product_type y tag:'sz:*')
    const parts = [];
    if (type) parts.push(`product_type:'${type}'`);
    if (size) parts.push(`tag:'${size}'`);
    const q = parts.join(' AND ') || '';

    const query = `
      query ProductsByQuery($q: String!, $first: Int!) {
        products(first: $first, query: $q) {
          edges {
            node {
              id
              title
              productType
              tags
              description
              descriptionHtml
              images(first: 4) { edges { node { url originalSrc src altText } } }
              priceRange { minVariantPrice { amount currencyCode } }
              variants(first: 50) {
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
      body: JSON.stringify({ query, variables: { q, first: Number(first) } }),
    });

    const json = await resp.json();
    if (!resp.ok || json.errors) {
      return res.status(200).json([]);
    }

    const products = (json.data?.products?.edges ?? []).map(({ node }) => ({
      id: node.id,
      title: node.title,
      productType: node.productType || '',
      tags: node.tags || [],
      description: node.descriptionHtml || node.description || '',
      image:
        node.images?.edges?.[0]?.node?.url ||
        node.images?.edges?.[0]?.node?.originalSrc ||
        node.images?.edges?.[0]?.node?.src ||
        '',
      minPrice: node.priceRange?.minVariantPrice || { amount: 0, currencyCode: 'CLP' },
      variants: (node.variants?.edges ?? []).map(({ node: v }) => ({
        id: v.id,
        availableForSale: v.availableForSale,
        selectedOptions: v.selectedOptions || [],
        image: v.image?.url || v.image?.originalSrc || v.image?.src || '',
        price: v.price || { amount: 0, currencyCode: 'CLP' },
        compareAtPrice: v.compareAtPrice || null,
      })),
    }));

    res.status(200).json(products);
  } catch (e) {
    console.error(e);
    res.status(200).json([]);
  }
}
