// pages/api/products.js
// Devuelve productos filtrados por TAG de tamaño ("Grande","Mediano","Pequeño")
// y opcionalmente por tipo usando tags "maceta" o "planta".
// Responde en forma estable: { size, type, count, products: [...] }

const STORE_DOMAIN =
  process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_DOMAIN; // ej: um7xus-0u.myshopify.com
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
// Usa una versión estable
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
  if (s === "maceta" || s === "pot" || s === "pots") return "maceta";
  if (s === "planta" || s === "plant" || s === "plants") return "planta";
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
    const first = Number(req.query.first || 30);

    // Construye el string de búsqueda. Puede quedar vacío.
    const filters = [];
    if (sizeTag) filters.push(`tag:'${sizeTag}'`);
    if (typeTag) filters.push(`tag:'${typeTag}'`);
    const search = filters.length ? filters.join(" ") : null;

    const query = /* GraphQL */ `
      query ProductsByQuery($first: Int!, $search: String) {
        products(first: $first, query: $search) {
          edges {
            node {
              id
              handle
              title
              tags
              images(first: 1) {
                edges { node { url altText } }
              }
              variants(first: 50) {
                edges {
                  node {
                    id
                    image { url altText }
                    price { amount currencyCode }
                    compareAtPrice { amount currencyCode }
                    selectedOptions { name value }
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
