// pages/api/design-product.js
// Crea o asegura un "producto DOBO" con una sola variante para el diseño actual.
// Requiere: process.env.SHOPIFY_ADMIN_TOKEN (Admin) y process.env.SHOPIFY_SHOP (p.ej "um7xus-0u.myshopify.com")
// Opcional: process.env.SHOPIFY_PUBLICATION_ID para publicar en un canal específico.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method-not-allowed" });

  try {
    const { title, price, previewUrl, color, size, designId, potTitle, plantTitle } = req.body || {};
    const shop = process.env.SHOPIFY_SHOP;
    const adminToken = process.env.SHOPIFY_ADMIN_TOKEN;

    if (!shop || !adminToken) {
      return res.status(500).json({ ok: false, error: "missing-admin-credentials" });
    }

    // 1) Crear producto con 1 variante
    const endpoint = `https://${shop}/admin/api/2024-07/graphql.json`;
    const q = `mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product { id title handle variants(first:1){nodes{id title sku}} }
        userErrors{ field message }
      }
    }`;
    const input = {
      title: title || `DOBO ${plantTitle || ""} + ${potTitle || ""}`.trim(),
      status: "ACTIVE",
      variants: [{
        title: `${color || "Único"} / ${size || "Único"}`,
        price: String(price || 0),
        sku: designId || `dobo-${Date.now()}`,
        inventoryPolicy: "CONTINUE",
      }],
      // Opcional: descripción corta (sin imágenes pesadas)
      descriptionHtml: `<p>DOBO personalizado · Color: ${color || "Único"} · Tamaño: ${size || "Único"}</p>`,
    };

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
      body: JSON.stringify({ query: q, variables: { input } }),
    });
    const j = await resp.json();
    const err = j?.data?.productCreate?.userErrors?.[0]?.message || j?.errors?.[0]?.message;
    const product = j?.data?.productCreate?.product;
    if (!resp.ok || err || !product) {
      return res.status(500).json({ ok: false, error: err || `admin-http-${resp.status}` });
    }

    const variantId = product?.variants?.nodes?.[0]?.id;

    // 2) Publicación opcional
    try {
      const pubId = process.env.SHOPIFY_PUBLICATION_ID;
      if (pubId) {
        const qPub = `mutation publishablePublish($id: ID!, $pubId: ID!) {
          publishablePublish(id: $id, input: {publicationId: $pubId}){
            publishable { ... on Product { id title } }
            userErrors { field message }
          }
        }`;
        await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": adminToken,
          },
          body: JSON.stringify({ query: qPub, variables: { id: product.id, pubId } }),
        });
      }
    } catch {}

    // 3) (Opcional) subir media del preview como imagen en el producto, sin bloquear el flujo
    if (previewUrl) {
      try {
        const mediaQ = `mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
          productCreateMedia(productId: $productId, media: $media) {
            media{preview{image{url}}}
            mediaUserErrors{ field message }
          }
        }`;
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken },
          body: JSON.stringify({
            query: mediaQ,
            variables: { productId: product.id, media: [{ originalSource: previewUrl }] },
          }),
        });
      } catch {}
    }

    return res.status(200).json({ ok: true, productId: product.id, variantId });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
