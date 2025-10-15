// pages/api/design-product.js
// Crea/actualiza un producto DOBO y devuelve variantId (Admin GraphQL, sin images ni variants dentro de ProductInput)

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const SHOP = process.env.SHOPIFY_SHOP; // p.ej. "um7xus-0u.myshopify.com"
  const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
  const PUB_ID = process.env.SHOPIFY_PUBLICATION_ID || null; // opcional

  if (!SHOP || !ADMIN_TOKEN) {
    return res.status(500).json({ ok: false, error: "missing-admin-env" });
  }

  const {
    title = "DOBO personalizado",
    designId,
    price = 0,
    color = "Único",
    size = "Único",
    previewUrl = "",
    plantTitle = "",
    potTitle = "",
    shortDescription = "Diseño DOBO personalizado",
  } = (await safeJson(req)) || {};

  if (!designId) {
    return res.status(400).json({ ok: false, error: "missing-designId" });
  }

  const handle = `dobo-${String(designId).toLowerCase().replace(/[^a-z0-9\-]+/g, "-")}`;
  const productTitle = title || `DOBO ${plantTitle || ""} + ${potTitle || ""}`.trim();
  const priceStr = String(Number(price || 0).toFixed(2));

  try {
    // 1) upsert producto (sin images/variants)
    const existing = await adminFetch(SHOP, ADMIN_TOKEN, {
      query: `
        query Q($handle: String!) {
          productByHandle(handle: $handle) {
            id
            handle
            variants(first: 5) { nodes { id } }
          }
        }
      `,
      variables: { handle },
    });

    let productId = existing?.data?.productByHandle?.id || null;
    let variantId = existing?.data?.productByHandle?.variants?.nodes?.[0]?.id || null;

    if (!productId) {
      const create = await adminFetch(SHOP, ADMIN_TOKEN, {
        query: `
          mutation M($input: ProductInput!) {
            productCreate(input: $input) {
              product { id handle }
              userErrors { field message }
            }
          }
        `,
        variables: {
          input: {
            title: productTitle,
            handle,
            productType: "DOBO",
            tags: ["DOBO"],
            status: "ACTIVE", // válido en Admin GraphQL
            descriptionHtml: escapeHtml(shortDescription),
            options: ["Título"], // evita warnings si luego agregas variantes simples
          },
        },
      });

      const errs = create?.data?.productCreate?.userErrors || [];
      if (errs.length) throw new Error(errs.map(e => e.message).join("; "));
      productId = create?.data?.productCreate?.product?.id;
      if (!productId) throw new Error("no-product-id");
    }

    // 2) variante: crear si falta; si existe, actualizar precio
    if (!variantId) {
      const vcreate = await adminFetch(SHOP, ADMIN_TOKEN, {
        query: `
          mutation M($productId: ID!, $variant: ProductVariantInput!) {
            productVariantCreate(productId: $productId, variant: $variant) {
              productVariant { id }
              userErrors { field message }
            }
          }
        `,
        variables: {
          productId,
          variant: {
            title: "Único",
            price: priceStr,
            // puedes añadir compareAtPrice si lo necesitas
          },
        },
      });
      const errs = vcreate?.data?.productVariantCreate?.userErrors || [];
      if (errs.length) throw new Error(errs.map(e => e.message).join("; "));
      variantId = vcreate?.data?.productVariantCreate?.productVariant?.id;
      if (!variantId) throw new Error("no-variant-id");
    } else {
      // actualizar precio si ya existe
      await adminFetch(SHOP, ADMIN_TOKEN, {
        query: `
          mutation M($id: ID!, $input: ProductVariantInput!) {
            productVariantUpdate(id: $id, input: $input) {
              productVariant { id }
              userErrors { field message }
            }
          }
        `,
        variables: { id: variantId, input: { price: priceStr } },
      });
    }

    // 3) publicar si hay publication id
    if (PUB_ID) {
      await adminFetch(SHOP, ADMIN_TOKEN, {
        query: `
          mutation M($id: ID!, $pub: ID!) {
            publishablePublish(id: $id, input: { publicationId: $pub }) {
              userErrors { field message }
            }
          }
        `,
        variables: { id: productId, pub: PUB_ID },
      });
    }

    // 4) opcional: guarda preview/meta como metafields (no obligatorio para el checkout)
    // Aquí un ejemplo simple; coméntalo si no usas namespace/key propios
    if (previewUrl) {
      await adminFetch(SHOP, ADMIN_TOKEN, {
        query: `
          mutation M($ownerId: ID!, $metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              userErrors { field message }
            }
          }
        `,
        variables: {
          ownerId: productId,
          metafields: [{
            ownerId: productId,
            namespace: "dobo",
            key: "preview_url",
            type: "single_line_text_field",
            value: previewUrl,
          }],
        },
      });
    }

    return res.status(200).json({ ok: true, productId, variantId, handle });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

async function adminFetch(shop, token, body) {
  const r = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { throw new Error(text); }
  if (!r.ok || json?.errors) {
    throw new Error(JSON.stringify(json?.errors || json));
  }
  return json;
}

async function safeJson(req) {
  try {
    const buf = await new Promise((res, rej) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => res(Buffer.concat(chunks).toString("utf8")));
      req.on("error", rej);
    });
    return JSON.parse(buf || "{}");
  } catch { return {}; }
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>\"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}
