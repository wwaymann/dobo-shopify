// pages/api/design-product.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method-not-allowed" });
  }

  const SHOP =
    process.env.SHOPIFY_SHOP || process.env.NEXT_PUBLIC_SHOP_DOMAIN;
  const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
  const PUB_ID = process.env.SHOPIFY_PUBLICATION_ID; // "Tienda online"

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
      // 🔹 attrs “adelgazados” para email (opcionales)
      attrs: attrsIn = [],
    } = (req.body && typeof req.body === "object") ? req.body : {};

    const product = {
      title: String(title || `DOBO ${plantTitle} + ${potTitle}`).slice(0, 250),
      status: "active", // ✅ que nazca activo
      vendor: "DOBO",
      product_type: "DOBO",
      body_html: shortDescription?.trim()
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

    // 1) Crear producto (REST)
    const createResp = await fetch(
      `https://${SHOP}/admin/api/${apiVersion}/products.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": ADMIN_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product }),
      }
    );

    const raw = await createResp.text();
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }

    if (!createResp.ok || json?.errors) {
      return res.status(createResp.status || 500).json({
        ok: false,
        error: "admin:create-product",
        details: json?.errors || raw || `HTTP ${createResp.status}`,
      });
    }

    const created = json?.product;
    const variant = created?.variants?.[0];
    const adminGraphQLId = created?.admin_graphql_api_id;

    if (!variant?.id || !adminGraphQLId) {
      return res
        .status(500)
        .json({ ok: false, error: "missing-variant-or-gid", details: created });
    }

    // 2) Publicar en “Tienda online” (GraphQL) si tenemos PublicationId
    if (PUB_ID) {
      const gql = `
        mutation PublishToOnlineStore($id: ID!, $pubId: ID!) {
          publishablePublish(id: $id, input: { publicationId: $pubId }) {
            userErrors { field message }
          }
        }
      `;
      const gresp = await fetch(
        `https://${SHOP}/admin/api/${apiVersion}/graphql.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": ADMIN_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: gql,
            variables: { id: adminGraphQLId, pubId: PUB_ID },
          }),
        }
      );

      const gjson = await gresp.json().catch(() => ({}));
      const errs = gjson?.data?.publishablePublish?.userErrors;
      if (!gresp.ok || (errs && errs.length)) {
        console.warn("publishablePublish error", errs || gjson);
      }
    }

    // 3) Enviar correo (desde el backend)
    try {
      // URL absoluta a tu propia API (sirve en Vercel/prod y local)
      const proto = req.headers["x-forwarded-proto"] || "https";
      const host =
        req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_URL;
      const base = `${proto}://${host}`;

      // Sanitizar attrs del body (si vinieron)
      const attrs = Array.isArray(attrsIn)
        ? attrsIn.map((a) => ({
            key: String(a?.key || ""),
            value: String(a?.value ?? ""),
          }))
        : [];

      // Dominio storefront para armar link al producto
      const shopHost = String(
        process.env.SHOPIFY_SHOP || SHOP || "um7xus-0u.myshopify.com"
      )
        .replace(/^https?:\/\//i, "")
        .replace(/\/+$/g, "");

      const emailPayload = {
        attrs,
        meta: {
          Descripcion: shortDescription || "DOBO",
          Precio: Number(price || 0),
        },
        links: created?.handle
          ? { "Producto (storefront)": `https://${shopHost}/products/${created.handle}` }
          : {},
        attachPreviews: true, // el endpoint intentará adjuntar previews/capas https
      };

      const eresp = await fetch(`${base}/api/send-design-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload),
      });

      if (!eresp.ok) {
        const edetail = await eresp.text().catch(() => "");
        console.warn("send-design-email not ok:", eresp.status, edetail);
      }
    } catch (e) {
      console.warn("post-create email failed (non-blocking):", e?.message || e);
    }

    // 4) Responder al cliente
    return res.status(200).json({
      ok: true,
      productId: created.id,
      variantId: variant.id, // numérico (el cliente puede convertir a GID si hace falta)
      handle: created.handle || "",
      image: created?.image?.src || (created?.images?.[0]?.src ?? ""),
      adminGraphQLId,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: "unhandled", details: e?.message || String(e) });
  }
}

function escapeHtml(s = "") {
  return String(s).replace(/[&<>\"']/g, (m) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
  });
}
