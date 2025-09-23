// pages/api/design/email-now.js
import nodemailer from "nodemailer";
export const config = { api: { bodyParser: { sizeLimit: "25mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { to, subject = "DOBO – Diseño para edición", html, attachments = [] } =
    typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const dest = to || process.env.MERCHANT_NOTIF_EMAIL;
  if (!user || !pass || !dest) return res.status(400).json({ error: "Faltan GMAIL_USER/GMAIL_APP_PASSWORD o destino" });

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass }
  });

  await transporter.sendMail({
    from: `"DOBO" <${user}>`,
    to: dest,
    subject,
    html: html || "<p>Adjuntos de diseño DOBO.</p>",
    attachments: attachments.map(a => ({
      filename: a.filename || "file.bin",
      content: Buffer.from(String(a.base64 || ""), "base64"),
      contentType: a.contentType || "application/octet-stream",
    })),
  });

  return res.status(200).json({ ok: true });
}
