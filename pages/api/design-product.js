// pages/api/design-product.js
// Crea (o actualiza) el "Producto DOBO" a partir de un diseño y devuelve el variantId
// Requiere server envs: SHOPIFY_SHOP, SHOPIFY_ADMIN_TOKEN
// (opcional) SHOPIFY_PUBLICATION_ID para publicar.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }
  try {
    const shop =
      process.env.SHOPIFY_SHOP ||
      process.env.NEXT_PUBLIC_SHOP_DOMAIN ||
      process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
    const adminToken =
      process.env.SHOPIFY_ADMIN_TOKEN ||
      process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ||
      process.env.ADMIN_API_ACCESS_TOKEN; // cualquiera que uses
    if (!shop || !adminToken) {
      return res
        .status(500)
        .json({ ok: false, error: "missing-server-env(SHOPIFY_SHOP/ADMIN_TOKEN)" });
    }

    const {
      title,
      previewUrl, // URL http(s) preferible (si es data:, se ignora para imagen)
      price,
      color,
      size,
      designId,
      plantTitle,
      potTitle,
      shortDescription,
    } = req.body || {};

    const safeTitle = title || `DOBO ${plantTitle || ""} + ${potTitle || ""}`.trim();
    const handle = String(designId || Date.now())
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const doboHandle = `dobo-${handle}`;

    const endpoint = `https://${shop}/admin/api/2024-07/graphql.json`;
    const headers = {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": adminToken,
    };

    const qProductByHandle = `
      query($handle: String!) {
        productByHandle(handle: $handle) {
          id
          variants(first: 1) { edges { node { id } } }
        }
      }`;

    async function adminGQL(query, variables) {
      const r = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.errors) {
        const msg = j?.errors?.[0]?.message || `HTTP ${r.status}`;
        throw new Error(msg);
      }
      return j.data;
    }

    const descHtml = `<p>${shortDescription || "Diseño DOBO personalizado"}</p>`;

    const images = [];
    if (previewUrl && /^https?:\/\//i.test(previewUrl)) {
      images.push({ src: previewUrl });
    }

    // 1) ¿Existe ya?
    const existing = await adminGQL(qProductByHandle, { handle: doboHandle });
    const product = existing?.productByHandle;

    let productId = null;
    let variantId = null;

    if (product?.id) {
      // Update
      const m = `mutation($input: ProductInput!) {
        productUpdate(input: $input) {
          product { id variants(first: 1) { edges { node { id } } } }
          userErrors { field message }
        }
      }`;
      const upd = await adminGQL(m, {
        input: {
          id: product.id,
          title: safeTitle,
          handle: doboHandle,
          descriptionHtml: descHtml,
          tags: ["DOBO", "custom"],
          vendor: "DOBO",
          productType: "DOBO",
          images,
        },
      });
      productId = upd?.productUpdate?.product?.id || product.id;
      variantId =
        upd?.productUpdate?.product?.variants?.edges?.[0]?.node?.id ||
        product?.variants?.edges?.[0]?.node?.id ||
        null;
      // opcional: price update on variant
      if (variantId && price != null) {
        const priceM = `mutation($id: ID!, $price: Money!) {
          productVariantUpdate(input: { id: $id, price: $price }) {
            productVariant { id }
            userErrors { field message }
          }
        }`;
        try { await adminGQL(priceM, { id: variantId, price: String(price) }); } catch {}
      }
    } else {
      // Create
      const m = `mutation($input: ProductInput!) {
        productCreate(input: $input) {
          product { id handle variants(first: 1) { edges { node { id } } } }
          userErrors { field message }
        }
      }`;
      const crt = await adminGQL(m, {
        input: {
          title: safeTitle,
          handle: doboHandle,
          descriptionHtml: descHtml,
          tags: ["DOBO", "custom"],
          vendor: "DOBO",
          productType: "DOBO",
          images,
          variants: [
            {
              title: `${color || "Único"} / ${size || "Único"}`,
              price: price != null ? String(price) : undefined,
            },
          ],
        },
      });
      if (crt?.productCreate?.userErrors?.length) {
        throw new Error(crt.productCreate.userErrors[0].message);
      }
      productId = crt?.productCreate?.product?.id || null;
      variantId = crt?.productCreate?.product?.variants?.edges?.[0]?.node?.id || null;

      // 2) Publicar (si hay publicationId)
      if (productId && process.env.SHOPIFY_PUBLICATION_ID) {
        const pubM = `mutation($id: ID!, $pubId: ID!) {
          publishablePublish(id: $id, input: [{publicationId: $pubId}]) {
            userErrors { message }
          }
        }`;
        try {
          await adminGQL(pubM, { id: productId, pubId: process.env.SHOPIFY_PUBLICATION_ID });
        } catch {}
      }
    }

    if (!variantId) return res.status(500).json({ ok: false, error: "no-variant" });
    return res.status(200).json({ ok: true, variantId, productId });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
