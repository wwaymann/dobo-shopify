// pages/api/design-product.js
export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "method-not-allowed" });

  const shop = process.env.SHOPIFY_SHOP;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  const publicationId = process.env.SHOPIFY_PUBLICATION_ID || null;

  if (!shop || !token) {
    return res
      .status(501)
      .json({ ok: false, error: "admin-api-not-configured" });
  }

  try {
    const { title, price, color, size, designId, plantTitle, potTitle } =
      req.body || {};
    const product = {
      product: {
        title: title || `DOBO ${Date.now()}`,
        body_html: `DOBO personalizado — ${plantTitle || "Planta"} + ${
          potTitle || "Maceta"
        } — Color: ${color || "Único"} — Tamaño: ${size || "Único"}`,
        vendor: "DOBO",
        tags: ["DOBO", "custom"],
        variants: [
          {
            price: String(price ?? "0"),
            inventory_management: "SHOPIFY",
            inventory_policy: "CONTINUE",
            sku: designId || `dobo-${Date.now()}`,
            option1: color || "Único",
            option2: size || "Único",
          },
        ],
        options: [
          { name: "Color", values: [color || "Único"] },
          { name: "Tamaño", values: [size || "Único"] },
        ],
      },
    };

    const createRes = await fetch(
      `https://${shop}/admin/api/2024-07/products.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify(product),
      }
    );
    const j = await createRes.json();
    if (!createRes.ok || !j?.product?.variants?.[0]?.id) {
      return res
        .status(502)
        .json({ ok: false, error: "admin-create-failed", detail: j });
    }

    const variantId = j.product.variants[0].id;

    if (publicationId && j?.product?.id) {
      try {
        await fetch(
          `https://${shop}/admin/api/2024-07/publications/${publicationId}/publish.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": token,
            },
            body: JSON.stringify({
              publication: { id: publicationId },
              published_product_ids: [j.product.id],
            }),
          }
        );
      } catch {}
    }

    return res.status(200).json({ ok: true, variantId });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: String(e?.message || e) });
  }
}
