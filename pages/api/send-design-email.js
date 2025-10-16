// pages/api/send-design-email.js
import nodemailer from "nodemailer";

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[c]));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method-not-allowed" });

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const defaultTo = process.env.MERCHANT_NOTIF_EMAIL || user;

  if (!user || !pass || !defaultTo) {
    return res.status(500).json({ ok: false, error: "Missing env: GMAIL_USER / GMAIL_APP_PASSWORD / MERCHANT_NOTIF_EMAIL" });
  }

  const { attrs = [], meta = {}, links = {}, to, attachAll = false } = req.body || {};

  // Detectar URLs de imagen (preview/capas) desde attrs
  const lower = s => String(s || "").toLowerCase();
  const urlish = v => typeof v === "string" && /^https?:\/\//.test(v);

  const previews = (attrs || []).filter(a =>
    lower(a?.key).includes("preview") || lower(a?.key).includes("thumb")
  );

  const layers = attachAll
    ? (attrs || []).filter(a =>
        lower(a?.key).includes("layer") || lower(a?.key).endsWith(".png") || lower(a?.value).endsWith(".png")
      )
    : [];

  const urls = [...previews, ...layers]
    .map(a => a?.value)
    .filter(urlish);

  // Adjunta hasta 10 imágnes remotas
  const attachments = urls.slice(0, 10).map((u, i) => ({
    filename: `img_${i + 1}.png`,
    path: u,
  }));

  const html = `
    <h2>Nuevo diseño DOBO</h2>
    <p><b>Fecha:</b> ${new Date().toISOString()}</p>
    ${Object.entries(meta).map(([k, v]) => `<p><b>${escapeHtml(k)}:</b> ${escapeHtml(String(v))}</p>`).join("")}
    ${Object.entries(links).map(([k, v]) => `<p><a href="${escapeHtml(String(v))}">${escapeHtml(k)}</a></p>`).join("")}
    ${previews.length ? `<p><img src="${escapeHtml(String(previews[0].value))}" style="max-width:520px;" /></p>` : ""}
    <details><summary>Attrs</summary><pre>${escapeHtml(JSON.stringify(attrs, null, 2))}</pre></details>
  `;

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from: user,
      to: to || defaultTo,
      subject: `DOBO - Nuevo diseño${meta?.Descripcion ? " · " + meta.Descripcion : ""}`,
      html,
      attachments,
    });

    return res.status(200).json({ ok: true, id: info?.messageId || null, attachments: attachments.length });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
