// Crea un "producto DOBO" vía Shopify Admin REST y devuelve variantId numérico.
// NOTA: usamos req.body (no re-leer el stream) para evitar el "Promise <pending>".

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method-not-allowed" });
  }

  const SHOP = process.env.SHOPIFY_SHOP || process.env.NEXT_PUBLIC_SHOP_DOMAIN;
  const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

  if (!SHOP || !ADMIN_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "missing-env",
      details: {
        need: ["SHOPIFY_SHOP", "SHOPIFY_ADMIN_TOKEN"],
        have: { SHOP: Boolean(SHOP), ADMIN_TOKEN: Boolean(ADMIN_TOKEN) },
      },
    });
  }

  try {
    // ✅ AQUÍ el cambio clave: usar req.body
    const {
      title = "DOBO",
      price = 0,
      previewUrl = "",
      color = "",
      size = "",
      designId = `dobo-${Date.now()}`,
      plantTitle = "",
      potTitle = "",
      shortDescription = "",
    } = (req.body && typeof req.body === "object") ? req.body : {};

    // Construcción mínima y válida para Admin REST
    const product = {
      title: String(title || `DOBO ${plantTitle} + ${potTitle}`).slice(0, 250),
      status: "draft",
      vendor: "DOBO",
      product_type: "DOBO",
      body_html:
        shortDescription?.trim()
          ? escapeHtml(shortDescription.trim())
          : escapeHtml(
              [
                "DOBO personalizado",
                plantTitle && `Planta: ${plantTitle}`,
                potTitle && `Maceta: ${potTitle}`,
                size && `Tamaño: ${size}`,
                color && `Color: ${color}`,
              ]
                .filter(Boolean)
                .join(" · ")
            ),
      // IMPORTANTÍSIMO: tags como STRING, no array
      tags: [
        "DOBO",
        "custom",
        plantTitle && `plant:${plantTitle}`,
        potTitle && `pot:${potTitle}`,
        size && `size:${size}`,
        color && `color:${color}`,
        designId && `design:${designId}`,
      ]
        .filter(Boolean)
        .join(", "),
      images: previewUrl ? [{ src: String(previewUrl) }] : [],
      // 1 sola variante (Default Title). No mandamos product.options
      variants: [
        {
          price: String(Number(price || 0)),
          option1: "Default Title",
          sku: String(designId),
          inventory_management: null,
          inventory_policy: "deny",
          taxable: false,
        },
      ],
    };

    const apiVersion = "2024-07";
    const url = `https://${SHOP}/admin/api/${apiVersion}/products.json`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": ADMIN_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ product }),
    });

    const text = await resp.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }

    if (!resp.ok || json?.errors) {
      return res.status(resp.status || 500).json({
        ok: false,
        error: "admin:create-product",
        details: json?.errors || text || `HTTP ${resp.status}`,
      });
    }

    const created = json?.product;
    const variant = created?.variants?.[0];

    if (!variant?.id) {
      return res.status(500).json({
        ok: false,
        error: "missing-variant",
        details: created || json,
      });
    }

    return res.status(200).json({
      ok: true,
      productId: created.id,
      variantId: variant.id, // numérico => sirve directo para /cart/add
      image: created?.image?.src || (created?.images?.[0]?.src ?? ""),
      adminGraphQLId: created?.admin_graphql_api_id,
      variantGraphQLId: variant?.admin_graphql_api_id,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "unhandled",
      details: e?.message || String(e),
    });
  }
}

function escapeHtml(s = "") {
  return String(s).replace(/[&<>\"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[m]);
}
