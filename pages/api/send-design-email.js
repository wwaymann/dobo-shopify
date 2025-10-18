// pages/api/send-design-email.js
// Deja tu configuración de nodemailer/transporter como ya la tienes.
import nodemailer from "nodemailer";

// Ejemplo minimal: usa el que ya tengas configurado
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const FROM = process.env.MAIL_FROM || "no-reply@dobo.app";
const TO   = process.env.MAIL_TO   || "orders@dobo.app";

// Helper para leer attrs por clave (case-insensitive)
function pickAttr(attrs, key) {
  const k = String(key || "").toLowerCase();
  return (attrs.find(a => String(a.key || "").toLowerCase() === k) || {}).value || "";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

    const { subject, attrs = [], meta = {}, links = {} } = req.body || {};

    // DO / NO (desde attrs)
    const doNum = pickAttr(attrs, "_DO") || pickAttr(attrs, "DO");
    const noNum = pickAttr(attrs, "_NO") || pickAttr(attrs, "NO");

    // Asunto: usa el recibido si llegó, si no compone "DO … · NO …"
    const emailSubject =
      (subject && String(subject).trim()) ||
      [doNum && `DO ${doNum}`, noNum && `NO ${noNum}`].filter(Boolean).join(" · ") ||
      "DOBO";

    // URLs adjuntas (si existen)
    const designPreview = pickAttr(attrs, "DesignPreview"); // integrado
    const overlayAll    = pickAttr(attrs, "Overlay:All");   // overlay completo
    const layerImage    = pickAttr(attrs, "Layer:Image");
    const layerText     = pickAttr(attrs, "Layer:Text");

    // Adjuntos (solo los que tengan URL)
    const attachments = [
      designPreview && { filename: "DesignPreview.png", path: designPreview },
      overlayAll    && { filename: "Overlay-All.png",    path: overlayAll },
      layerImage    && { filename: "Layer-Image.png",    path: layerImage },
      layerText     && { filename: "Layer-Text.png",     path: layerText },
    ].filter(Boolean);

    // Cuerpo del correo
    const desc  = meta?.Descripcion || "";
    const precio= meta?.Precio || "";
    const store = links?.Storefront || "";

    await transporter.sendMail({
      from: FROM,
      to: TO,
      subject: emailSubject,
      text:
`Asunto: ${emailSubject}
Descripcion: ${desc}
Precio: ${precio}
Tienda: ${store}
DO: ${doNum || "-"}
NO: ${noNum || "-"}`.trim(),
      html:
`<div>
  <p><b>${emailSubject}</b></p>
  <p>${desc || ""}</p>
  <p><b>Precio:</b> ${precio || "-"}</p>
  ${store ? `<p><a href="${store}" target="_blank" rel="noopener">Ver en tienda</a></p>` : ""}
  <p>DO: ${doNum || "-"} · NO: ${noNum || "-"}</p>
</div>`,
      attachments,
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("send-design-email error", e);
    return res.status(500).json({ ok: false, error: "sendmail-failed" });
  }
}
