// pages/api/design-product.js
// Crea un "producto DOBO" via Shopify Admin REST y devuelve variantId numérico para /cart/add

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
        have: {
          SHOP: Boolean(SHOP),
          ADMIN_TOKEN: Boolean(ADMIN_TOKEN),
        },
      },
    });
  }

  try {
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
    } = (await safeJson(req)) || {};

    // ---- Construcción mínima y válida para Admin REST ----
    const product = {
      title: String(title || `DOBO ${plantTitle} + ${potTitle}`).slice(0, 250),
      status: "draft",
      vendor: "DOBO",
      product_type: "DOBO",
      // Usa descripción corta si se envía; si no, generamos una compacta
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
      // IMPORTANTE: tags debe ser **string** separada por comas
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
      // Preview por URL (opcional)
      images: previewUrl ? [{ src: String(previewUrl) }] : [],
      // Una sola variante (Default Title) con precio; NO mandamos product.options
      variants: [
        {
          price: String(Number(price || 0)),
          option1: "Default Title",
          sku: String(designId),
          inventory_management: null, // sin control de inventario
          inventory_policy: "deny",
          taxable: false,
        },
      ],
    };

    const apiVersion = "2024-07"; // o la que uses en el resto del proyecto
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
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    // Shopify REST devuelve { errors: ... } en 422 o 400
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
      variantId: variant.id, // **numérico**, sirve para /cart/add
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

async function safeJson(req) {
  try {
    const buf = await new Promise((r) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => r(data));
    });
    return JSON.parse(buf || "{}");
  } catch {
    return {};
  }
}
