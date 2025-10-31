// pages/api/webhooks/shopify/orders-paid.js

// 👉 si usas otra ruta (por ejemplo /api/webhooks/shopify.js) pega esto ahí.
// 👉 este archivo asume que YA tienes /api/send-design-email funcionando
//    (lo usabas en el index 39).

export const config = {
  api: {
    bodyParser: true, // ya vimos que tu webhook actual recibe JSON normal
  },
};

// guardamos el último evento para /api/webhooks/_health
let LAST_EVENT = null;

// helper: normaliza las propiedades que vienen desde Shopify
function normalizeLineItemProps(props = []) {
  const norm = {};
  const list = [];

  for (const p of props) {
    if (!p || !p.name) continue;
    const rawKey = String(p.name);
    const value = String(p.value ?? "");

    // guardamos tal cual llegó, para mostrar en _health
    list.push({ key: rawKey, value });

    // normalizamos: sin _ inicial, sin :, sin espacios, minúscula
    const k = rawKey
      .toLowerCase()
      .replace(/^_+/, "")
      .replace(/[:\s]+/g, "");

    norm[k] = value;
  }

  return { norm, list };
}

// helper: arma la URL base para llamarnos a nosotros mismos
function getBaseUrl(req) {
  // intenta con las envs típicas de Vercel
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SELF_URL ||
    process.env.VERCEL_URL;

  if (envUrl) {
    // si viene sin protocolo, se lo ponemos
    if (/^https?:\/\//i.test(envUrl)) return envUrl;
    return `https://${envUrl}`;
  }

  // fallback: host del request
  const host = req.headers.host;
  return `https://${host}`;
}

export default async function handler(req, res) {
  // pequeño healthcheck como el que ya tienes
  if (req.method === "GET" && "_health" in req.query) {
    return res.json({
      ok: true,
      last: LAST_EVENT,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const topic =
      req.headers["x-shopify-topic"] ||
      req.body?.topic ||
      "orders/paid"; // por si acaso
    const shop =
      req.headers["x-shopify-shop-domain"] ||
      req.body?.shop_domain ||
      req.body?.shop ||
      "unknown-shop";

    const order = req.body || {};
    const orderId = order.id || order.order_id || order.name || null;

    const lineItems = Array.isArray(order.line_items)
      ? order.line_items
      : [];
    // tomamos la primera línea que tenga properties (suele ser la del DOBO)
    const mainLine =
      lineItems.find((li) => Array.isArray(li.properties) && li.properties.length) ||
      lineItems[0] ||
      {};

    const { norm, list: attrs } = normalizeLineItemProps(
      mainLine.properties || []
    );

    // acá viene lo importante:
    // Shopify muchas veces NO deja pasar claves con ":" (Overlay:All)
    // y tampoco deja pasar mayúsculas… por eso las buscamos en varias formas
    const designPreview =
      norm.previewfull ||
      norm.designpreview ||
      norm.preview ||
      norm.design ||
      ""; // el integrado
    const overlayAll =
      norm.overlayall ||
      norm.overlay ||
      norm.overlayallpng ||
      "";
    const layerImage =
      norm.layerimage ||
      norm.layerimg ||
      norm.layerpng ||
      "";
    const layerText =
      norm.layertext ||
      norm.layertexto ||
      "";

    // DO / NO (estos sí vimos que llegan)
    const doNum = norm.do || norm.dobo || norm.designid || "";
    const noNum =
      norm.no ||
      norm._no || // por si acaso
      ""; 

    // guardamos para el _health
    LAST_EVENT = {
      topic,
      shop,
      paid: true,
      orderId,
      mainLineProps: norm,
      attrs,
      ts: Date.now(),
    };

    // si no tenemos NADA de diseño, igual respondemos ok para que Shopify no reintente
    if (!designPreview && !overlayAll && !layerImage && !layerText) {
      // PERO dejamos rastro
      console.warn("[DOBO webhook] Pedido pagado SIN capas de diseño", {
        orderId,
        norm,
      });

      return res.json({
        ok: true,
        note: "paid-without-design",
        last: LAST_EVENT,
      });
    }

    // si llegamos acá, hay algún material de diseño → llamamos a /api/send-design-email
    const baseUrl = getBaseUrl(req);
    const emailPayload = {
      subject: `DOBO – pedido pagado ${order.name || orderId || ""}`,
      orderId: orderId,
      shop,
      designPreview,
      overlayAll,
      layerImage,
      layerText,
      doNum,
      noNum,
      // mandamos TODO por si tu /api/send-design-email lo necesita
      rawOrder: order,
      attrs,
    };

    // llamamos a nuestro endpoint interno
    try {
      const r = await fetch(`${baseUrl}/api/send-design-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload),
      });

      const jr = await r.json().catch(() => ({}));
      if (!r.ok || !jr?.ok) {
        console.warn("[DOBO webhook] /api/send-design-email no respondió ok", {
          status: r.status,
          body: jr,
        });
      }
    } catch (err) {
      console.warn(
        "[DOBO webhook] error llamando a /api/send-design-email",
        err
      );
    }

    return res.json({ ok: true, last: LAST_EVENT });
  } catch (err) {
    console.error("[DOBO webhook] error general", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
