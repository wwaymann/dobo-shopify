// pages/api/send-design-email.js
// Enviar correo con (opcional) descarga de previews/capas por URL.
// Requiere: GMAIL_USER, GMAIL_APP_PASSWORD, MERCHANT_NOTIF_EMAIL en Vercel.
// IMPORTANTE: Este handler corre en Node, no en Edge.

import nodemailer from "nodemailer";

// Si usas app router en /app/api, añade:
// export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const {
      // opcionales desde el cliente:
      to,                      // permite probar enviando a otro destinatario
      subject = "Nuevo diseño DOBO",
      attachPreviews = false,  // si true y hay URLs válidas, se adjuntan como archivos
      attrs = [],              // [{key, value}, ...]   (ej: DesignPreview, Layer:Base, etc.)
      meta = {},               // {Descripcion, Precio, ...}
      links = {},              // {Storefront: 'https://...', Producto: '...'}
    } = (req.body || {});

    // === ENV obligatorios ===
    const GMAIL_USER = process.env.GMAIL_USER;
    const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
    const DEFAULT_TO = process.env.MERCHANT_NOTIF_EMAIL || process.env.GMAIL_USER;

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !DEFAULT_TO) {
      return res.status(500).json({ ok: false, error: "Missing email env (GMAIL_USER/GMAIL_APP_PASSWORD/MERCHANT_NOTIF_EMAIL)" });
    }

    // === Transport real (NO jsonTransport) ===
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });

    // Verifica credenciales (útil en Vercel)
    await transporter.verify().catch(() => { /* si falla, nodemailer fallará al send */ });

    // === Render de texto simple (evita HTML complejo) ===
    const now = new Date().toISOString();
    const lines = [];

    lines.push(`Nuevo diseño DOBO`);
    lines.push(`Fecha: ${now}`);
    lines.push("");

    // meta
    const metaKeys = Object.keys(meta || {});
    if (metaKeys.length) {
      metaKeys.forEach(k => lines.push(`${k}: ${meta[k]}`));
      lines.push("");
    }

    // links
    const linkKeys = Object.keys(links || {});
    if (linkKeys.length) {
      lines.push("Enlaces");
      linkKeys.forEach(k => lines.push(`${k}: ${links[k]}`));
      lines.push("");
    }

    // attrs
    if (Array.isArray(attrs) && attrs.length) {
      lines.push("Attrs");
      lines.push(JSON.stringify(attrs, null, 2));
      lines.push("");
    }

    const textBody = lines.join("\n");

    // === Adjuntos desde URLs si attachPreviews ===
    const urlAttrs = (Array.isArray(attrs) ? attrs : []).filter(a => {
      const v = String(a?.value || "");
      return /^https?:\/\//i.test(v);
    });

    let attachments = [];
    if (attachPreviews && urlAttrs.length) {
      // OJO: fetch disponible en Node 20 en Vercel
      const MAX_ATTACH = 6; // cota de seguridad
      for (const a of urlAttrs.slice(0, MAX_ATTACH)) {
        const url = String(a.value);
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const buf = Buffer.from(await r.arrayBuffer());
          const safeKey = String(a.key || "preview").replace(/[^a-z0-9_\-]/gi, "_");
          // intenta obtener extensión por URL
          const ext = (url.split("?")[0].split("#")[0].match(/\.(png|jpg|jpeg|webp|gif)$/i)?.[0] || ".png");
          attachments.push({
            filename: `${safeKey}${ext}`,
            content: buf,
          });
        } catch (_e) {
          // ignora esa capa si falla descarga
        }
      }
    }

    // === Determina destinatario final ===
    // Si "to" viene en body, úsalo para pruebas. Si no, envía al DEFAULT_TO (MERCHANT_NOTIF_EMAIL).
    const TO = String(to || DEFAULT_TO);

    // Nota: si TO === GMAIL_USER (tú mismo), Gmail no muestra en "Recibidos";
    // verás el mensaje en "Enviados". Mejor prueba con otro correo distinto.

    const info = await transporter.sendMail({
      from: `"DOBO Bot" <${GMAIL_USER}>`,
      to: TO,
      subject,
      text: textBody,
      attachments,
      // opcional: replyTo: "soporte@tudominio.com",
    });

    return res.status(200).json({
      ok: true,
      id: info?.messageId || null,
      attachments: attachments.length,
      to: TO,
    });
  } catch (e) {
    console.error("send-design-email error:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
