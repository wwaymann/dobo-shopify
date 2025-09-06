// pages/api/products.js
const STORE_DOMAIN =
  process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_DOMAIN;
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_STOREFRONT_API_VERSION || "2025-01";
const ENDPOINT = `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`;

function normalizeSize(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (["grande", "g"].includes(s)) return "Grande";
  if (["mediano", "m"].includes(s)) return "Mediano";
  if (["pequeño", "pequeno", "p"].includes(s)) return "Pequeño";
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  if (!STORE_DOMAIN || !STOREFRONT_TOKEN) {
    return res.status(500).json({ error: "Faltan variables de entorno Shopify" });
  }

  const sizeTag = normalizeSize(req.query.size); // opcional
  const type = (req.query.type || "").toString().trim().toLowerCase();
  const parts = [];
  if (sizeTag) parts.push(`tag:'${sizeTag}'`);
  if (type === "maceta") parts.push(`tag:'maceta'`);
  if (type === "planta") parts.push(`tag:'planta'`);
  if (parts.length === 0) parts.push("status:active");

  const gql = /* GraphQL */ `
    query ProductsByQuery($search: String!, $first: Int!) {
      products(first: $first, query: $search) {
        edges {
          node {
            id
            handle
            title
            tags
            images(first: 1) {
              edges {
                node { url altText }
              }
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  price { amount currencyCode }
                  compareAtPrice { amount currencyCode }
                  image { url altText }
                  selectedOptions { name value }
                }
              }
            }
            priceRangeV2 { minVariantPrice { amount currencyCode } }
          }
        }
      }
    }
  `;

  const variables = {
    search: parts.join(" "),
    first: Number(req.query.first || 30),
  };

  try {
    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query: gql, variables }),
    });
    const json = await resp.json();
    if (!resp.ok || json.errors) {
      return res.status(502).json({ error: "Error desde Shopify", details: json.errors || json });
    }

    const items =
      json.data?.products?.edges?.map(({ node }) => ({
        id: node.id,
        handle: node.handle,
        title: node.title,
        tags: node.tags,
        image: node.images?.edges?.[0]?.node?.url || null,
        alt: node.images?.edges?.[0]?.node?.altText || null,
        variants: node.variants?.edges?.map(e => e.node) || [],
        minPrice: node.priceRangeV2?.minVariantPrice || null,
      })) || [];

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ size: sizeTag || null, count: items.length, products: items });
  } catch (e) {
    return res.status(500).json({ error: "Fallo de red o parsing", details: String(e) });
  }
}
