// pages/api/design/email-now.js
import nodemailer from "nodemailer";

export const config = { api: { bodyParser: { sizeLimit: "15mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const {
      to,
      subject = "DOBO – Diseño para edición",
      html,
      meta = {},
      attachments = [], // [{ filename, base64, contentType }]
    } = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const TO = to || process.env.MERCHANT_NOTIF_EMAIL;
    if (!TO) return res.status(400).json({ error: "Missing destination email" });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    const metaRows = Object.entries(meta)
      .map(([k, v]) => `<tr><td style="padding:4px 8px;"><b>${k}</b></td><td style="padding:4px 8px;">${String(v || "")}</td></tr>`)
      .join("");

    const mail = await transporter.sendMail({
      from: `"DOBO" <${process.env.GMAIL_USER}>`,
      to: TO,
      subject,
      html:
        html ||
        `<p>Adjunto diseño para edición.</p>${metaRows ? `<table border="0" cellspacing="0" cellpadding="0">${metaRows}</table>` : ""}`,
      attachments: (attachments || []).map((a) => ({
        filename: a.filename || "file.bin",
        content: Buffer.from(String(a.base64 || ""), "base64"),
        contentType: a.contentType || "application/octet-stream",
      })),
    });

    return res.status(200).json({ ok: true, id: mail.messageId });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "send_failed", detail: String(e?.message || e) });
  }
}
