// pages/api/webhooks/shopify.js
import crypto from "crypto";
import nodemailer from "nodemailer";

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"]/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[m]));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return res.status(500).end("Missing SHOPIFY_WEBHOOK_SECRET");

  const raw = await readRawBody(req);
  const sentHmac = req.headers["x-shopify-hmac-sha256"];
  const calc = crypto.createHmac("sha256", secret).update(raw).digest("base64");
  if (sentHmac !== calc) return res.status(401).end("Invalid HMAC");

  const topic = String(req.headers["x-shopify-topic"] || "");
  if (!["orders/paid", "orders/create"].includes(topic)) {
    return res.status(202).end("Ignored topic");
  }

  let order;
  try { order = JSON.parse(raw.toString("utf8")); }
  catch { return res.status(400).end("Invalid JSON"); }

  const isPaid = topic === "orders/paid" || order?.financial_status === "paid";
  if (!isPaid) return res.status(202).end("Not paid");

  const lineItems = Array.isArray(order?.line_items) ? order.line_items : [];
  const blocks = [];

  for (let i = 0; i < lineItems.length; i++) {
    const li = lineItems[i];
    const propsArr = Array.isArray(li?.properties) ? li.properties : [];
    const props = {};
    for (const p of propsArr) props[p?.name] = p?.value;

    const title = li?.title || "";
    const qty   = li?.quantity || 1;
    const DO    = props._DO || props.DO || "";
    const NO    = props._NO || props.NO || (li?.variant_id ? String(li.variant_id) : "");

    const preview  = props["DesignPreview"] || props["_DesignPreview"] || "";
    const overlay  = props["Overlay:All"]   || props["OverlayAll"]     || props["_OverlayAll"] || "";
    const layerImg = props["Layer:Image"]   || props["LayerImage"]     || props["_LayerImage"] || "";
    const layerTxt = props["Layer:Text"]    || props["LayerText"]      || props["_LayerText"]  || "";

    blocks.push(`
      <h3 style="margin:16px 0 8px">Ítem ${i + 1}: ${escapeHtml(title)}</h3>
      <p style="margin:0 0 8px">Cantidad: ${qty} · DO: ${escapeHtml(DO)} · NO: ${escapeHtml(NO)}</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${preview  ? `<div><div style="font-weight:600">Preview</div><img src="${preview}"  style="max-width:240px;border:1px solid #ddd;border-radius:8px"/></div>` : ""}
        ${overlay  ? `<div><div style="font-weight:600">Overlay</div><img src="${overlay}"  style="max-width:240px;border:1px solid #ddd;border-radius:8px"/></div>` : ""}
        ${layerImg ? `<div><div style="font-weight:600">Layer Image</div><img src="${layerImg}" style="max-width:240px;border:1px solid #ddd;border-radius:8px"/></div>` : ""}
        ${layerTxt ? `<div><div style="font-weight:600">Layer Text</div><img src="${layerTxt}" style="max-width:240px;border:1px solid #ddd;border-radius:8px"/></div>` : ""}
      </div>
    `);
  }

  const subject = `Pedido pagado ${order?.name || "#" + order?.id || ""}`;
  const to = process.env.MAIL_TO;
  const from = process.env.MAIL_FROM || to;
  if (!to) return res.status(500).end("Missing MAIL_TO");

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    to, from, subject,
    html: `
      <div style="font-family:system-ui,Segoe UI,Roboto,Arial">
        <h2>Pedido pagado ${escapeHtml(order?.name || "")}</h2>
        <p style="margin:4px 0">Cliente: ${escapeHtml(order?.email || "")}</p>
        <p style="margin:4px 0">Total: ${escapeHtml(order?.total_price || "")} ${escapeHtml(order?.currency || "")}</p>
        ${blocks.join('<hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>')}
      </div>`,
  });

  return res.status(200).json({ ok: true });
}
