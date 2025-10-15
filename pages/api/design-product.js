// pages/api/design-product.js
// Creates a "DOBO" product in Shopify Admin and returns variantId + product info.
// Requires env: SHOPIFY_SHOP (e.g. myshop.myshopify.com), SHOPIFY_ADMIN_TOKEN
// Optional env: SHOPIFY_PUBLICATION_ID (to publish), SHOPIFY_COLLECTION_ID_DOBOS (to add to a collection)

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method-not-allowed" });
  try {
    const SHOP = process.env.SHOPIFY_SHOP;
    const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
    if (!SHOP || !TOKEN) {
      return res.status(500).json({ ok: false, error: "Missing env SHOPIFY_SHOP/SHOPIFY_ADMIN_TOKEN" });
    }

    const {
      title,
      previewUrl,
      price,
      color = "Único",
      size = "Único",
      designId,
      potTitle = "Maceta",
      plantTitle = "Planta",
      shortDescription,
      metafields = {},
    } = (await req.json?.()) || req.body || {};

    const productTitle = title || `DOBO ${plantTitle} + ${potTitle}`;
    const desc = shortDescription || "DOBO personalizado (planta + maceta).";

    // Build Admin REST payload
    const body = {
      product: {
        title: productTitle,
        body_html: desc,
        status: "active",
        tags: "dobo,custom",
        options: ["Color", "Tamaño"],
        variants: [
          {
            option1: color || "Único",
            option2: size || "Único",
            price: String(Number(price || 0).toFixed(0)),
            sku: `DOBO-${(designId || Date.now()).toString()}`
          }
        ],
        images: previewUrl ? [{ src: previewUrl }] : undefined,
      }
    };

    const api = `https://${SHOP}/admin/api/2023-10/products.json`;
    const r = await fetch(api, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": TOKEN,
      },
      body: JSON.stringify(body),
    });

    const raw = await r.text();
    let j; try { j = JSON.parse(raw); } catch { j = {}; }

    if (!r.ok || !j?.product?.variants?.[0]?.id) {
      return res.status(500).json({ ok: false, error: j?.errors || raw });
    }

    const product = j.product;
    const variantId = product.variants[0].id;

    // Optional: Publish to a publication
    try {
      const pubId = process.env.SHOPIFY_PUBLICATION_ID;
      if (pubId) {
        await fetch(`https://${SHOP}/admin/api/2023-10/publications/${pubId}/publication_listings.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
          body: JSON.stringify({ publication_listing: { publication_id: pubId, product_id: product.id } }),
        });
      }
    } catch {}

    // Optional: add to a collection
    try {
      const collId = process.env.SHOPIFY_COLLECTION_ID_DOBOS;
      if (collId) {
        await fetch(`https://${SHOP}/admin/api/2023-10/collects.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
          body: JSON.stringify({ collect: { collection_id: collId, product_id: product.id } }),
        });
      }
    } catch {}

    // Optional: set metafields
    try {
      const entries = Object.entries(metafields);
      for (const [key, value] of entries) {
        await fetch(`https://${SHOP}/admin/api/2023-10/metafields.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
          body: JSON.stringify({
            metafield: { namespace: "dobo", key, value: String(value ?? ""), type: "single_line_text_field", owner_id: product.id, owner_resource: "product" }
          }),
        });
      }
      if (designId) {
        await fetch(`https://${SHOP}/admin/api/2023-10/metafields.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
          body: JSON.stringify({
            metafield: { namespace: "dobo", key: "design_id", value: String(designId), type: "single_line_text_field", owner_id: product.id, owner_resource: "product" }
          }),
        });
      }
      if (previewUrl) {
        await fetch(`https://${SHOP}/admin/api/2023-10/metafields.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
          body: JSON.stringify({
            metafield: { namespace: "dobo", key: "preview_url", value: String(previewUrl), type: "url", owner_id: product.id, owner_resource: "product" }
          }),
        });
      }
    } catch {}

    return res.status(200).json({
      ok: true,
      productId: product.id,
      variantId,
      handle: product.handle,
      product,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
