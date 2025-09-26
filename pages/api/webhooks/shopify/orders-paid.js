// pages/api/webhooks/shopify/orders-paid.js
export const config = { api: { bodyParser: false } };

import crypto from "crypto";

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).end(); return; }

  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) { res.status(500).json({ error: "Missing SHOPIFY_WEBHOOK_SECRET" }); return; }

  const raw = await readRaw(req);
  const sig = String(req.headers["x-shopify-hmac-sha256"] || "");
  const digest = crypto.createHmac("sha256", secret).update(raw).digest("base64");

  // comparación constante
  const ok =
    sig.length === digest.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest));
  if (!ok) { res.status(401).json({ error: "Invalid HMAC" }); return; }

  let payload;
  try { payload = JSON.parse(raw.toString("utf8")); }
  catch { res.status(400).json({ error: "Invalid JSON" }); return; }

  // Reenvía al generador de PDF+adjuntos ya existente
  const base = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
  const r = await fetch(`${base}/api/order-assets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-flow-secret": process.env.ORDER_FLOW_SECRET || ""
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const txt = await r.text();
    res.status(500).json({ ok: false, forwarded: false, error: txt.slice(0, 500) });
    return;
  }
  const j = await r.json();
  res.status(200).json({ ok: true, forwarded: true, result: j });
}
