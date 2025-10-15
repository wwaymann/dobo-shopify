// pages/api/products.js
// Trae productos por tipo/size desde Storefront
const buildQuery = (type, size) => {
  const parts = [];
  if (type) parts.push(`product_type:${JSON.stringify(type)}`);
  if (size) parts.push(`tag:${JSON.stringify(size)}`);
  return parts.join(" AND ");
};

export default async function handler(req, res) {
  try {
    const { type = "", size = "", first = 24 } = req.query;

    const domain =
      process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ||
      process.env.NEXT_PUBLIC_SHOP_DOMAIN ||
      process.env.SHOPIFY_SHOP;
    const token =
      process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;
    if (!domain || !token) {
      return res.status(200).json({ products: [] });
    }

    const endpoint = `https://${domain}/api/2024-07/graphql.json`;
    const query = `#graphql
      query Products($query: String, $first: Int!) {
        products(first: $first, query: $query) {
          edges {
            node {
              id
              title
              handle
              description
              descriptionHtml
              tags
              images(first: 1) { edges { node { url } } }
              variants(first: 50) {
                edges {
                  node {
                    id
                    title
                    price { amount currencyCode }
                    compareAtPrice { amount currencyCode }
                    image { url }
                    selectedOptions { name value }
                  }
                }
              }
            }
          }
        }
      }`;

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({
        query,
        variables: { query: buildQuery(type, size) || undefined, first: Number(first) || 24 },
      }),
    });

    const json = await resp.json();
    const items = json?.data?.products?.edges?.map(e => e.node) || [];

    const normalized = items.map(p => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      description: p.description || "",
      descriptionHtml: p.descriptionHtml || "",
      tags: p.tags || [],
      image: p.images?.edges?.[0]?.node?.url || "",
      variants: (p.variants?.edges || []).map(v => ({
        id: v.node.id,
        title: v.node.title,
        price: v.node.price,
        compareAtPrice: v.node.compareAtPrice,
        image: v.node.image?.url || "",
        selectedOptions: v.node.selectedOptions || [],
      })),
      minPrice: (p.variants?.edges?.[0]?.node?.price) || { amount: 0, currencyCode: "CLP" },
    }));

    res.status(200).json({ products: normalized });
  } catch (e) {
    console.error("products api error", e);
    res.status(200).json({ products: [] });
  }
}