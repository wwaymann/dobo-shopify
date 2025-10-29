// pages/api/shopify/order-paid.js
import crypto from "crypto";

export const config = {
  api: { bodyParser: false }, // necesitamos el raw body para verificar HMAC
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verifyShopifyHmac(rawBody, hmacHeader, secret) {
  if (!hmacHeader || !secret) return false;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

function normProps(line) {
  const out = {};
  const list = Array.isArray(line?.properties) ? line.properties : [];
  for (const p of list) {
    const k = String(p?.name ?? p?.key ?? "").trim();
    const v = String(p?.value ?? "");
    if (k) out[k] = v;
  }
  return out;
}

// Asunto tipo: "DO 12345678 · NO 47208327512312"
function makeEmailSubject({ doNum, noNum }) {
  const parts = [];
  if (doNum) parts.push(`DO ${doNum}`);
  if (noNum) parts.push(`NO ${noNum}`);
  return parts.length ? parts.join(" · ") : "DOBO";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const raw = await readRawBody(req);
  const hmac = req.headers["x-shopify-hmac-sha256"];
  const topic = String(req.headers["x-shopify-topic"] || "");
  const shop = String(req.headers["x-shopify-shop-domain"] || "");

  const ok = verifyShopifyHmac(raw, hmac, process.env.SHOPIFY_WEBHOOK_SECRET);
  if (!ok) return res.status(401).json({ ok: false, error: "invalid-hmac" });

  let order;
  try {
    order = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.status(400).json({ ok: false, error: "invalid-json" });
  }

  // Sólo proceder cuando esté pagado (defensa extra si te llega otro topic)
  const isPaid =
    topic.toLowerCase() === "orders/paid" ||
    String(order?.financial_status || "").toLowerCase() === "paid";

  if (!isPaid) {
    return res.status(200).json({ ok: true, skipped: "not-paid" });
  }

  const lineItems = Array.isArray(order?.line_items) ? order.line_items : [];

  // Filtra solo líneas DOBO (que llevan tus propiedades de diseño)
  const designLines = lineItems.filter((li) => {
    const props = normProps(li);
    return (
      props["_DesignId"] ||
      props["DesignPreview"] ||
      props["_DesignPreview"] ||
      props["Overlay:All"] ||
      props["Layer:Image"] ||
      props["Layer:Text"]
    );
  });

  // Si no hay líneas con diseño, no hay nada que enviar.
  if (designLines.length === 0) {
    return res.status(200).json({ ok: true, skipped: "no-design-lines" });
  }

  // Envía un correo por cada línea con diseño (o ajusta a 1 si prefieres uno por orden)
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || `https://${req.headers.host}`;

  const results = [];
  for (const li of designLines) {
    const props = normProps(li);

    // Normaliza nombres/alias de tus claves
    const preview =
      props["DesignPreview"] ||
      props["_DesignPreview"] ||
      props["Preview:Full"] ||
      "";
    const overlay =
      props["Overlay:All"] || props["OverlayAll"] || props["_OverlayAll"] || "";
    const layerImg =
      props["Layer:Image"] || props["LayerImage"] || props["_LayerImage"] || "";
    const layerTxt =
      props["Layer:Text"] || props["LayerText"] || props["_LayerText"] || "";
    const designId = props["_DesignId"] || props["DesignId"] || "";
    const doNum = (designId || "").toString().slice(-8).toUpperCase();
    const noNum = String(li?.variant_id || "");

    // Construye attrs como los espera tu /api/send-design-email
    const attrs = [];
    const push = (k, v) => v && attrs.push({ key: k, value: v });
    push("DesignPreview", preview);
    push("Overlay:All", overlay);
    push("Layer:Image", layerImg);
    push("Layer:Text", layerTxt);
    push("_DesignId", designId);
    push("_DO", doNum);
    push("_NO", noNum);

    // Meta del correo
    const descripcion =
      `${li?.title || "DOBO"} · ${li?.variant_title || ""}`.trim();
    const precio = order?.current_total_price || order?.total_price || "";

    // Llama a tu endpoint existente de email (reutiliza tu pipeline actual)
    const payload = {
      subject: makeEmailSubject({ doNum, noNum }),
      attrs,
      meta: { Descripcion: descripcion, Precio: precio },
      links: { Storefront: `https://${shop}` },
      attachPreviews: true,
      attachOverlayAll: true,
    };

    try {
      const r = await fetch(`${baseUrl}/api/send-design-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      results.push({ ok: r.ok && j?.ok, status: r.status, j });
    } catch (e) {
      results.push({ ok: false, error: String(e) });
    }
  }

  return res.status(200).json({ ok: true, processed: results.length, results });
}
