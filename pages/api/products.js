// pages/api/products.js
// Busca productos por TAG de tamaño: "Grande", "Mediano", "Pequeño"

const STORE_DOMAIN =
  process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_DOMAIN; // ej: "um7xus-0u.myshopify.com"
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_STOREFRONT_API_VERSION || "2025-01";

const ENDPOINT = `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`;

function normalizeSize(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (["grande", "g"].includes(s)) return "Grande";
  if (["mediano", "m"].includes(s)) return "Mediano";
  // soporta con y sin tilde
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

  const sizeTag = normalizeSize(req.query.size);
  if (!sizeTag) {
    return res.status(400).json({ error: "Parámetro 'size' inválido. Use Grande, Mediano o Pequeño." });
  }

  // Construye la query de Shopify. Importante: el filtro por tag va dentro del string de búsqueda.
  const gql = /* GraphQL */ `
    query ProductsByTag($search: String!, $first: Int!) {
      products(first: $first, query: $search) {
        edges {
          node {
            id
            handle
            title
            tags
            images(first: 1) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
          }
        }
      }
    }
  `;

  // Ejemplo de búsqueda:  tag:'Grande'
  const variables = {
    search: `tag:'${sizeTag}'`,
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
      return res.status(502).json({
        error: "Error desde Shopify",
        details: json.errors || json,
      });
    }

    const items =
      json.data?.products?.edges?.map(({ node }) => ({
        id: node.id,
        handle: node.handle,
        title: node.title,
        tags: node.tags,
        image: node.images?.edges?.[0]?.node?.url || null,
        alt: node.images?.edges?.[0]?.node?.altText || null,
      })) || [];

    // Cache suave para Vercel (opcional)
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

    return res.status(200).json({ size: sizeTag, count: items.length, products: items });
  } catch (e) {
    return res.status(500).json({ error: "Fallo de red o parsing", details: String(e) });
  }
}
