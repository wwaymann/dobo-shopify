// pages/api/webhooks/shopify.js
import crypto from "crypto";

export const config = { api: { bodyParser: false } };

// lee el body crudo sin dependencias externas
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function verifyHmac(rawBody, req, secret) {
  const hmacHeader = req.headers["x-shopify-hmac-sha256"];
  if (!hmacHeader || !secret) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  // Evita timing leaks sólo si longitudes coinciden
  try {
    return crypto.timingSafeEqual(Buffer.from(hmacHeader), Buffer.from(digest));
  } catch {
    return hmacHeader === digest;
  }
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

function buildEmailAttrsFromProps(propsObj) {
  // normaliza claves (acepta con/sin guión bajo y alias)
  const val = (...keys) => {
    for (const k of keys) {
      if (propsObj[k] != null) return String(propsObj[k]);
      const k2 = k.startsWith("_") ? k.slice(1) : `_${k}`;
      if (propsObj[k2] != null) return String(propsObj[k2]);
    }
    return "";
  };

  const attrs = [];
  const push = (key, value) => value && attrs.push({ key, value });

  // principales
  push("DesignPreview", val("DesignPreview", "Preview:Full", "PreviewFull"));
  push("Overlay:All",   val("Overlay:All", "OverlayAll"));
  push("Layer:Image",   val("Layer:Image", "LayerImage"));
  push("Layer:Text",    val("Layer:Text", "LayerText"));

  // DO/NO y metadatos
  push("_DesignId",   val("DesignId"));
  push("_DesignPlant", val("DesignPlant"));
  push("_DesignPot",   val("DesignPot"));
  push("_DesignColor", val("DesignColor"));
  push("_DesignSize",  val("DesignSize"));
  push("_DO",          val("DO"));
  push("_NO",          val("NO"));
  push("_LinePriority", val("LinePriority"));

  // recorta por seguridad
  return attrs.slice(0, 100);
}

export default async function handler(req, res) {
  try {
    const raw = await readRawBody(req);
    const okHmac = verifyHmac(raw, req, process.env.SHOPIFY_WEBHOOK_SECRET);
    if (!okHmac) {
      return res.status(401).json({ ok: false, error: "invalid-hmac" });
    }

    const topic = String(req.headers["x-shopify-topic"] || "");
    const shop  = String(req.headers["x-shopify-shop-domain"] || "");
    const payload = JSON.parse(raw.toString("utf8"));

    // Acepta orders/paid directamente o orders/create con pagado
    const isPaid =
      topic === "orders/paid" ||
      (topic === "orders/create" && String(payload?.financial_status || "").toLowerCase() === "paid");

    if (!isPaid) {
      return res.status(200).json({ ok: true, ignored: true, topic });
    }

    // Toma la línea principal (priority 0) o la primera
    const items = Array.isArray(payload?.line_items) ? payload.line_items : [];
    const main =
      items.find(li =>
        (li?.properties || []).some(p => p?.name === "_LinePriority" && String(p?.value) === "0")
      ) || items[0];

    const propsObj = kvListToObject(main?.properties || [], "name", "value");
    const attrs = buildEmailAttrsFromProps(propsObj);

    // DO/NO calculados si faltan
    const designId = propsObj["_DesignId"] || propsObj["DesignId"] || "";
    const doNum = (designId ? String(designId).slice(-8).toUpperCase() : (propsObj["DO"] || propsObj["_DO"] || ""));
    const noNum = String(main?.variant_id || main?.variant?.id || payload?.id || "");
    if (!attrs.some(a => a.key === "_DO") && doNum) attrs.push({ key: "_DO", value: doNum });
    if (!attrs.some(a => a.key === "_NO") && noNum) attrs.push({ key: "_NO", value: noNum });

    // Descripción corta para el correo
    const size  = propsObj["_DesignSize"]  || propsObj["DesignSize"]  || "";
    const color = propsObj["_DesignColor"] || propsObj["DesignColor"] || "";
    const potTitle   = main?.title || ""; // Shopify pone el título del variant/product
    const shortDescription = [potTitle, size, color].filter(Boolean).join(" · ");

    // Enlace base del sitio para armar llamada interna
    const siteHost =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `https://${req.headers["x-forwarded-host"] || req.headers.host}`);

    // Dispara TU endpoint ya existente de envío
    const emailPayload = {
      subject: (doNum || noNum) ? [`DO ${doNum || ""}`, `NO ${noNum || ""}`].filter(Boolean).join(" · ") : "DOBO",
      attrs,
      meta: { Descripcion: shortDescription, Precio: payload?.total_price || payload?.current_total_price || "" },
      links: {
        Order: `https://${shop}/admin/orders/${payload?.id || ""}`,
        Storefront: siteHost
      },
      attachPreviews: true,
      attachOverlayAll: true
    };

    const r = await fetch(`${siteHost}/api/send-design-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emailPayload)
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return res.status(200).json({ ok: false, error: "send-email-failed", detail: txt });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
}
