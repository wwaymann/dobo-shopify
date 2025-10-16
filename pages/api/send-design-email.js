// pages/api/send-design-email.js
// Runtime Node.js (no Edge), payload pequeño, logs, adjuntos opcionales por URL.

import nodemailer from "nodemailer";

export const config = {
  api: { bodyParser: { sizeLimit: "512kb" } }, // evita rechazos por tamaño
  // runtime: "nodejs"  // (en Pages Router suele ser Node por defecto; si usas App Router, usa route.js y runtime)
};

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const TO = process.env.MERCHANT_NOTIF_EMAIL || GMAIL_USER;

function safeList(arr) {
  return Array.isArray(arr) ? arr : [];
}
function isHttpUrl(s) {
  try { const u = new URL(String(s||"")); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, hint: "POST only" });
  }

  const started = Date.now();
  try {
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !TO) {
      console.error("[send-design-email] Missing envs");
      return res.status(200).json({ ok: false, error: "missing-env" });
    }

    const { attrs = [], meta = {}, links = {}, attachPreviews = false } = req.body || {};
    const thinAttrs = safeList(attrs).slice(0, 30);

    // Adjuntos livianos: sólo URLs http/https, no descargamos nada aquí.
    // Nodemailer acepta attachments como { filename, path: url }. Gmail descargará.
    const attachments = [];
    if (attachPreviews) {
      for (const a of thinAttrs) {
        const k = String(a?.key || "");
        const v = String(a?.value || "");
        if (!k || !isHttpUrl(v)) continue;
        attachments.push({ filename: `${k}.jpg`, path: v });
        if (attachments.length >= 5) break; // límite sano
      }
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });

    const html = `
      <h2>Nuevo diseño DOBO</h2>
      <p><b>Fecha:</b> ${new Date().toISOString()}</p>
      <h3>Resumen</h3>
      <pre style="white-space:pre-wrap;font-family:monospace">${escapeHtml(JSON.stringify(meta||{}, null, 2))}</pre>
      ${Object.keys(links||{}).length ? `
      <h3>Links</h3>
      <ul>
        ${Object.entries(links).map(([k,v]) => `<li><b>${escapeHtml(k)}:</b> <a href="${escapeAttr(v)}" target="_blank" rel="noopener">${escapeHtml(v)}</a></li>`).join("")}
      </ul>` : ""}
      <h3>Atributos</h3>
      <pre style="white-space:pre-wrap;font-family:monospace">${escapeHtml(JSON.stringify(thinAttrs, null, 2))}</pre>
      ${attachments.length ? `<p>Adjuntos: ${attachments.length}</p>` : "<p>Sin adjuntos</p>"}
    `;

    const info = await transporter.sendMail({
      from: `"DOBO Notifier" <${GMAIL_USER}>`,
      to: TO,
      subject: "Nuevo diseño DOBO",
      text: `Nuevo diseño DOBO\n\n${JSON.stringify(meta||{}, null, 2)}\n\nLinks:\n${Object.entries(links||{}).map(([k,v])=>`${k}: ${v}`).join("\n")}\n\nAttrs:\n${JSON.stringify(thinAttrs, null, 2)}`,
      html,
      attachments,
    });

    console.log("[send-design-email] sent", {
      id: info?.messageId,
      to: TO,
      attrs: thinAttrs.length,
      attachments: attachments.length,
      ms: Date.now() - started,
    });

    return res.status(200).json({ ok: true, id: info?.messageId || null, attachments: attachments.length });
  } catch (e) {
    console.error("[send-design-email] error", e);
    return res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
}

function escapeHtml(s="") {
  return String(s).replace(/[&<>"']/g,(c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function escapeAttr(s="") {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
