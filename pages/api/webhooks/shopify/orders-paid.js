// pages/api/webhooks/shopify/orders-paid.js
// o dentro de tu handler principal de /api/webhooks/shopify

export const config = {
  api: {
    bodyParser: false, // as usual con Shopify
  },
};

import crypto from "crypto";

// helper básico para leer el raw body de Shopify
async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// SI YA TIENES un verifyHmac en tu archivo, usa ese y borra este
function verifyShopifyHmac(rawBody, hmacHeader, secret) {
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  return crypto.timingSafeEqual(
    Buffer.from(digest, "utf8"),
    Buffer.from(hmacHeader || "", "utf8")
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true });
  }

  const shop = req.headers["x-shopify-shop-domain"] || "";
  const topic = req.headers["x-shopify-topic"] || "";
  const hmac = req.headers["x-shopify-hmac-sha256"] || "";

  const rawBody = await readRawBody(req);

  // ⚠️ pon tu secret real de Shopify acá
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_API_SECRET || "";

  if (secret && !verifyShopifyHmac(rawBody, hmac, secret)) {
    return res.status(401).json({ ok: false, error: "bad-hmac" });
  }

  const payload = JSON.parse(rawBody || "{}");

  // SOLO nos interesa cuando está pagado
  if (topic !== "orders/paid") {
    return res.status(200).json({ ok: true, skip: true });
  }

  const orderId = payload.id;
  const lineItems = payload.line_items || [];
  const mainLine = lineItems[0] || {};
  const props = Array.isArray(mainLine.properties) ? mainLine.properties : [];

  // acá es donde tu _health te estaba mostrando SOLO _NO
  // lo rearmamos en un formato que sirva para el mail
  const attrs = props
    .filter((p) => p && p.name) // limpia nulls
    .map((p) => ({ key: p.name, value: p.value }));

  // esto lo dejo igual que tu _health actual
  const last = {
    topic,
    shop,
    paid: true,
    orderId,
    mainLineProps: Object.fromEntries(
      props.map((p) => [p.name, p.value])
    ),
    attrs,
    ts: Date.now(),
  };

  // ⬇️⬇️⬇️ AQUÍ VIENE LA PARTE QUE TE FALTABA ⬇️⬇️⬇️

  // buscamos las imágenes que mandó el frontend
  // tu frontend las está mandando en estas keys:
  // _DesignPreview, _OverlayAll, _LayerImage, _LayerText
  const find = (name) =>
    attrs.find((a) => a.key === name)?.value ||
    attrs.find((a) => a.key.toLowerCase() === name.toLowerCase())?.value ||
    "";

  const designPreview = find("_DesignPreview") || find("DesignPreview");
  const overlayAll = find("_OverlayAll") || find("Overlay:All") || find("OverlayAll");
  const layerImage = find("_LayerImage") || find("Layer:Image") || find("LayerImage");
  const layerText = find("_LayerText") || find("Layer:Text") || find("LayerText");
  const doNum = find("_DO") || find("DO");
  const noNum = find("_NO") || find("NO");

  // si no hay al menos una imagen, no spameamos
  if (designPreview || overlayAll || layerImage || layerText) {
    try {
      // ojo: usa la misma ruta que ya tenías funcionando en el index viejo
      // (el que mandaba el mail directo)
      const base =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

      await fetch(`${base}/api/send-design-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `DOBO – Pedido pagado ${orderId || ""}`,
          orderId,
          shop,
          paid: true,
          attrs,
          mainLineProps: last.mainLineProps,
          // mando las 4 imágenes en campos explícitos
          designPreview,
          overlayAll,
          layerImage,
          layerText,
          doNum,
          noNum,
        }),
      });
    } catch (err) {
      console.error("[webhook] error enviando correo:", err);
    }
  }

  // devolvemos el mismo formato que viste
  return res.status(200).json({ ok: true, last });
}
