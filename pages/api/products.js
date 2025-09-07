// pages/api/products.js
const STORE_DOMAIN =
  process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_DOMAIN;
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_STOREFRONT_API_VERSION || "2024-10";
const ENDPOINT = `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`;

function normalizeSize(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === "grande" || s === "g") return "Grande";
  if (s === "mediano" || s === "m") return "Mediano";
  if (s === "pequeño" || s === "pequeno" || s === "p") return "Pequeño";
  return null;
}
function normalizeType(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (["maceta","macetas","pot","pots"].includes(s)) return "maceta";
  if (["planta","plantas","plant","plants"].includes(s)) return "planta";
  return null;
}
function buildTypeClause(t) {
  // Soporta tag, product_type y coincidencia en título
  if (t === "maceta") {
    return `(tag:'maceta' OR tag:'macetas' OR product_type:'maceta' OR product_type:'macetas' OR title:maceta)`;
  }
  if (t === "planta") {
    return `(tag:'planta' OR tag:'plantas' OR product_type:'planta' OR product_type:'plantas' OR title:planta)`;
  }
  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method Not Allowed" });
    }
    if (!STORE_DOMAIN || !STOREFRONT_TOKEN) {
      return res.status(500).json({ error: "Faltan variables de entorno Shopify" });
    }

    const sizeTag = normalizeSize(req.query.size);
    const typeTag = normalizeType(req.query.type);
    const first = Number(req.query.first || 60);

    const parts = [];
    if (sizeTag) parts.push(`tag:'${sizeTag}'`);
    const typeClause = buildTypeClause(typeTag);
    if (typeClause) parts.push(typeClause);

    // AND entre filtros; si no hay filtros, query = null
    const search = parts.length ? parts.join(" AND ") : null;

    const query = /* GraphQL */ `
      query ProductsByQuery($first: Int!, $search: String) {
        products(first: $first, query: $search) {
          edges {
            node {
              id
              handle
              title
              productType
              tags
              images(first: 1) { edges { node { url altText } } }
              variants(first: 50) {
                edges {
                  node {
                    id
                    image { url altText }
                    price { amount currencyCode }
                    compareAtPrice { amount currencyCode }
                    selectedOptions { name value }
                    availableForSale
                  }
                }
              }
              priceRange { minVariantPrice { amount currencyCode } }
            }
          }
        }
      }
    `;

    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables: { first, search } }),
    });

    const json = await resp.json();

    if (!resp.ok || json.errors) {
      console.error("Shopify error", {
        status: resp.status,
        errors: json.errors,
        search,
        endpoint: ENDPOINT,
      });
      return res.status(502).json({
        error: "Error desde Shopify",
        status: resp.status,
        details: json.errors || json,
        search,
      });
    }

    const products =
      json.data?.products?.edges?.map(({ node }) => ({
        id: node.id,
        handle: node.handle,
        title: node.title,
        productType: node.productType || "",
        tags: node.tags || [],
        image: node.images?.edges?.[0]?.node?.url || null,
        alt: node.images?.edges?.[0]?.node?.altText || null,
        variants:
          node.variants?.edges?.map((e) => ({
            id: e.node.id,
            image: e.node.image?.url || null,
            hasOwnImage: !!e.node.image?.url,
            price: e.node.price || null,
            compareAtPrice: e.node.compareAtPrice || null,
            selectedOptions: e.node.selectedOptions || [],
            availableForSale: !!e.node.availableForSale,
          })) || [],
        minPrice: node.priceRange?.minVariantPrice || null,
      })) || [];

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({
      size: sizeTag || null,
      type: typeTag || null,
      count: products.length,
      products,
    });
  } catch (e) {
    console.error("API /products exception", e);
    return res.status(500).json({ error: "Fallo de servidor", details: String(e) });
  }
}
