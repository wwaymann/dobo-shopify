// pages/api/webhooks/shopify.js
import crypto from "crypto";

export const config = { api: { bodyParser: false } };

// ——— memoria temporal para debug (último payload procesado) ———
let LAST = { topic: null, shop: null, paid: false, orderId: null, mainLineProps: null, attrs: null, ts: 0 };

// leer cuerpo crudo
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function verifyHmac(rawBody, req, secret) {
  const sig = req.headers["x-shopify-hmac-sha256"];
  if (!sig || !secret) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest)); }
  catch { return sig === digest; }
}

function kvListToObject(list = [], nameKey = "name", valueKey = "value") {
  const out = {};
  for (const it of list) {
    const k = String(it?.[nameKey] || "").trim();
    if (!k) continue;
    out[k] = String(it?.[valueKey] ?? "");
  }
  return out;
}

function buildEmailAttrsFromProps(props) {
  const get = (...keys) => {
    for (const k of keys) {
      if (props[k] != null) return String(props[k]);
      const k2 = k.startsWith("_") ? k.slice(1) : `_${k}`;
      if (props[k2] != null) return String(props[k2]);
    }
    return "";
  };
  const attrs = [];
  const push = (k, v) => v && attrs.push({ key: k, value: v });

  // capas
  push("DesignPreview", get("DesignPreview", "Preview:Full", "PreviewFull"));
  push("Overlay:All",   get("Overlay:All", "OverlayAll"));
  push("Layer:Image",   get("Layer:Image", "LayerImage"));
  push("Layer:Text",    get("Layer:Text",  "LayerText"));

  // meta
  push("_DesignId",    get("DesignId"));
  push("_DesignPlant", get("DesignPlant"));
  push("_DesignPot",   get("DesignPot"));
  push("_DesignColor", get("DesignColor"));
  push("_DesignSize",  get("DesignSize"));
  push("_LinePriority", get("LinePriority"));
  push("_DO", get("DO"));
  push("_NO", get("NO"));

  return attrs.slice(0, 100);
}

export default async function handler(req, res) {
  // ——— GET = inspección rápida del último webhook recibido ———
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, last: LAST });
  }

  const raw = await readRawBody(req);
  const okHmac = verifyHmac(raw, req, process.env.SHOPIFY_WEBHOOK_SECRET);
  if (!okHmac) {
    console.warn("[WEBHOOK] invalid HMAC");
    return res.status(401).json({ ok: false, error: "invalid-hmac" });
  }

  let payload = {};
  try { payload = JSON.parse(raw.toString("utf8")); } catch {}

  const topic = String(req.headers["x-shopify-topic"] || "");
  const shop  = String(req.headers["x-shopify-shop-domain"] || "");
  const isPaid =
    topic === "orders/paid" ||
    (topic === "orders/create" && String(payload?.financial_status || "").toLowerCase() === "paid");

  const orderId = payload?.id || null;
  console.log("[WEBHOOK] topic=", topic, "shop=", shop, "paid=", isPaid, "order_id=", orderId);

  // Respondemos rápido para que Shopify no reintente
  res.status(200).json({ ok: true, accepted: true });

  // Solo actuamos si está pagado
  if (!isPaid) return;

  try {
    const items = Array.isArray(payload?.line_items) ? payload.line_items : [];
    const main =
      items.find(li =>
        (li?.properties || []).some(p => p?.name === "_LinePriority" && String(p?.value) === "0")
      ) || items[0];

    const propsObj = kvListToObject(main?.properties || [], "name", "value");
    const attrs = buildEmailAttrsFromProps(propsObj);

    const designId = propsObj["_DesignId"] || propsObj["DesignId"] || "";
    const doNum = (designId ? String(designId).slice(-8).toUpperCase() : (propsObj["DO"] || propsObj["_DO"] || ""));
    const noNum = String(main?.variant_id || payload?.id || "");

    if (doNum && !attrs.some(a => a.key === "_DO")) attrs.push({ key: "_DO", value: doNum });
    if (noNum && !attrs.some(a => a.key === "_NO")) attrs.push({ key: "_NO", value: noNum });

    const size  = propsObj["_DesignSize"]  || propsObj["DesignSize"]  || "";
    const color = propsObj["_DesignColor"] || propsObj["DesignColor"] || "";
    const shortDescription = [main?.title || "", size, color].filter(Boolean).join(" · ");

    const siteHost =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `https://${req.headers["x-forwarded-host"] || req.headers.host}`);

    // Guardamos último para inspección
    LAST = {
      topic, shop, paid: isPaid, orderId,
      mainLineProps: propsObj,
      attrs,
      ts: Date.now()
    };
    console.log("[WEBHOOK] main props:", propsObj);

    // Disparo del correo (fire-and-forget)
    fetch(`${siteHost}/api/send-design-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: (doNum || noNum) ? [`DO ${doNum || ""}`, `NO ${noNum || ""}`].filter(Boolean).join(" · ") : "DOBO",
        attrs,
        meta: { Descripcion: shortDescription, Precio: payload?.current_total_price || payload?.total_price || "" },
        links: {
          Order: `https://${shop}/admin/orders/${orderId || ""}`,
          Storefront: siteHost
        },
        attachPreviews: true,
        attachOverlayAll: true
      })
    }).then(r => {
      if (!r.ok) console.error("[WEBHOOK] send-design-email failed status", r.status);
    }).catch(err => console.error("[WEBHOOK] send-design-email error", err));

  } catch (e) {
    console.error("[WEBHOOK] process error", e);
  }
}
