// pages/api/send-design-email.js
import nodemailer from "nodemailer";

export const config = {
  api: { bodyParser: { sizeLimit: "6mb" } }, // por si envías payloads un poco grandes
};

function pick(x) {
  return String(x ?? "").trim();
}

function htmlEscape(s) {
  return pick(s).replace(/</g, "&lt;").replace(/>/g, "&gt;"); // harden HTML
}

function renderHTML({ designId, previewUrl, layers = [], meta = {}, links = {} }) {
  const metaRows = Object.entries(meta || {})
    .filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 10px;"><b>${htmlEscape(k)}</b></td><td style="padding:6px 10px;">${htmlEscape(
          String(v)
        )}</td></tr>`
    )
    .join("");

  const layerList = (layers || [])
    .map((L, i) => {
      const name = htmlEscape(L?.name || `Layer ${i + 1}`);
      const url = htmlEscape(L?.url || "");
      if (!url) return "";
      return `<li style="margin:4px 0;"><a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a></li>`;
    })
    .join("");

  const extraLinks = Object.entries(links || {})
    .filter(([_, v]) => v)
    .map(
      ([k, v]) =>
        `<li style="margin:4px 0;"><a href="${htmlEscape(String(v))}" target="_blank" rel="noopener noreferrer">${htmlEscape(
          k
        )}</a></li>`
    )
    .join("");

  return `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #222;">
      <h2 style="margin-bottom: 0.4rem;">Nuevo DOBO creado</h2>
      <p style="margin-top: 0.2rem;"><b>Design ID:</b> ${htmlEscape(designId || "")}</p>

      ${previewUrl ? `<p><img src="${htmlEscape(previewUrl)}" alt="Preview" style="max-width:560px;border:1px solid #eee;border-radius:8px;"/></p>` : ""}

      ${metaRows ? `
        <h3 style="margin-bottom:0.4rem;">Resumen</h3>
        <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #eee;">
          <tbody>${metaRows}</tbody>
        </table>
      ` : ""}

      ${layerList ? `
        <h3 style="margin-bottom:0.4rem;">Capas y recursos</h3>
        <ul style="padding-left: 18px; margin-top: 0;">${layerList}</ul>
      ` : `<p style="color:#999;">No se recibieron URLs de capas.</p>`}

      ${extraLinks ? `
        <h3 style="margin-bottom:0.4rem;">Enlaces</h3>
        <ul style="padding-left: 18px; margin-top: 0;">${extraLinks}</ul>
      ` : ""}
    </div>
  `;
}

async function urlToAttachment(url, filename) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "application/octet-stream";
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.length > 10 * 1024 * 1024) return null; // límite seguro 10MB por adjunto
    return { filename: filename || "design-preview.png", content: buf, contentType: ct };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const {
      to,
      subject,
      designId,
      previewUrl,
      layers = [],   // [{ name, url }]
      meta = {},     // { Color, Tamaño, Planta, Maceta, Precio, ... }
      links = {},    // { "Producto (storefront)": "...", "Producto (admin)": "..." }
      attachAll = false, // si true adjunta capas (ojo con tamaño)
    } = req.body || {};

    const user = pick(process.env.GMAIL_USER);
    const pass = pick(process.env.GMAIL_APP_PASSWORD);
    const defaultTo = pick(process.env.MERCHANT_NOTIF_EMAIL) || pick(process.env.EMAIL_TO_FALLBACK);

    if (!user || !pass) throw new Error("Missing Gmail env (GMAIL_USER / GMAIL_APP_PASSWORD)");
    const TO = pick(to) || defaultTo;
    if (!TO) throw new Error("Missing recipient (to or MERCHANT_NOTIF_EMAIL)");

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });

    const html = renderHTML({ designId, previewUrl, layers, meta, links });

    const attachments = [];
    if (previewUrl) {
      const att = await urlToAttachment(previewUrl, "design-preview.png");
      if (att) attachments.push(att);
    }
    if (attachAll) {
      for (const L of Array.isArray(layers) ? layers : []) {
        if (!L?.url) continue;
        const safeName = String(L?.name || "layer").replace(/[^\w.\-]+/g, "_");
        const att = await urlToAttachment(L.url, `${safeName}.png`);
        if (att) attachments.push(att);
      }
    }

    const info = await transporter.sendMail({
      from: `"DOBO" <${user}>`,
      to: TO,
      subject: pick(subject) || `DOBO listo – ${pick(designId || "")}`,
      html,
      attachments,
    });

    return res.status(200).json({ ok: true, id: info?.messageId || null });
  } catch (e) {
    console.error("send-design-email error:", e);
    return res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
}
