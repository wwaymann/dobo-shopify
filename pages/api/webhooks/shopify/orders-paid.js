// pages/api/send-design-email.js
import nodemailer from "nodemailer";

export const config = {
  api: {
    bodyParser: true,
  },
};

// helper para elegir el primer valor no vacío
function pick(...args) {
  for (const a of args) {
    if (a !== undefined && a !== null && a !== "") return a;
  }
  return "";
}

export default async function handler(req, res) {
  if (req.method === "GET" && "_health" in req.query) {
    return res.json({ ok: true, info: "send-design-email up" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = req.body || {};

    // 🚩 aquí soportamos AMBOS formatos
    const designPreview = pick(
      body.designPreview,
      body.previewFull,
      body.preview,
      body.DesignPreview,
      body["DesignPreview"],
      body["Preview:Full"]
    );
    const overlayAll = pick(
      body.overlayAll,
      body["Overlay:All"],
      body.overlay,
      body.Overlay,
      body["overlay:all"]
    );
    const layerImage = pick(
      body.layerImage,
      body["Layer:Image"],
      body.layerImg,
      body.layerPNG
    );
    const layerText = pick(
      body.layerText,
      body["Layer:Text"],
      body.layerTxt
    );

    const doNum = pick(body.doNum, body.DO, body._DO, body.do);
    const noNum = pick(body.noNum, body.NO, body._NO, body.no);

    const orderId = body.orderId || "";
    const shop = body.shop || "";
    const source = body.source || "client";

    console.log("[DOBO send-design-email] payload recibido", {
      source,
      orderId,
      shop,
      hasPreview: !!designPreview,
      hasOverlay: !!overlayAll,
      hasLayerImg: !!layerImage,
      hasLayerTxt: !!layerText,
      doNum,
      noNum,
    });

    // si NO hay ninguna imagen, igual respondemos ok para no romper nada
    if (!designPreview && !overlayAll && !layerImage && !layerText) {
      console.warn(
        "[DOBO send-design-email] sin imágenes/capas, respondo ok igual"
      );
      return res.json({ ok: true, note: "no-images" });
    }

    // HTML muy simple
    const htmlParts = [];
    htmlParts.push(`<h2>Nuevo diseño DOBO</h2>`);
    if (orderId) htmlParts.push(`<p><strong>Order:</strong> ${orderId}</p>`);
    if (shop) htmlParts.push(`<p><strong>Shop:</strong> ${shop}</p>`);
    if (doNum || noNum)
      htmlParts.push(
        `<p><strong>DO/NO:</strong> ${doNum || "-"} / ${noNum || "-"}</p>`
      );
    if (designPreview)
      htmlParts.push(
        `<p><strong>DesignPreview</strong><br><img src="${designPreview}" alt="preview" style="max-width:400px;border:1px solid #ccc"/></p>`
      );
    if (overlayAll)
      htmlParts.push(
        `<p><strong>Overlay:All</strong><br><img src="${overlayAll}" alt="overlay" style="max-width:400px;border:1px solid #ccc"/></p>`
      );
    if (layerImage)
      htmlParts.push(
        `<p><strong>Layer:Image</strong><br><img src="${layerImage}" alt="layer-img" style="max-width:400px;border:1px solid #ccc"/></p>`
      );
    if (layerText)
      htmlParts.push(
        `<p><strong>Layer:Text</strong><br><img src="${layerText}" alt="layer-txt" style="max-width:400px;border:1px solid #ccc;background:#fff"/></p>`
      );

    const html = htmlParts.join("\n");

    // SMTP desde env
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT
      ? Number(process.env.SMTP_PORT)
      : 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const to =
      process.env.DOBO_INBOX ||
      process.env.NOTIFY_EMAIL ||
      process.env.SMTP_TO ||
      "dev@dobo.local";

    // si no hay SMTP, lo registramos y devolvemos ok para que tú veas el log
    if (!host || !user || !pass) {
      console.warn(
        "[DOBO send-design-email] SMTP no configurado. Env vars faltan."
      );
      console.warn("Necesitas: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS");
      // igual devolvemos el HTML para que lo puedas ver en el log
      return res.json({
        ok: true,
        note: "smtp-not-configured",
        preview: html,
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const subject =
      body.subject ||
      `DOBO – diseño pagado ${orderId ? `#${orderId}` : ""}`.trim();

    const info = await transporter.sendMail({
      from: user,
      to,
      subject,
      html,
    });

    console.log("[DOBO send-design-email] enviado", info.messageId);

    return res.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    console.error("[DOBO send-design-email] error", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
