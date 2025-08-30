// pages/api/order-assets.js
import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UNSIGNED_PRESET;
const TO_EMAIL = process.env.MERCHANT_NOTIF_EMAIL;
const FLOW_SECRET = process.env.ORDER_FLOW_SECRET;

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const b64 = (buf) => Buffer.from(buf).toString("base64");

async function fetchAsBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo bajar: ${url}`);
  const a = await r.arrayBuffer();
  return Buffer.from(a);
}

async function uploadPdfToCloudinary(pdfBuffer, publicId) {
  const form = new FormData();
  form.append("file", new Blob([pdfBuffer]), `${publicId}.pdf`);
  form.append("upload_preset", PRESET);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/raw/upload`, {
    method: "POST",
    body: form,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || "Error Cloudinary RAW");
  return j.secure_url || j.url;
}

function buildPdfBuffer({ orderName, dobo, accessories }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Resumen de diseño DOBO");
    if (orderName) doc.moveDown(0.25).fontSize(12).fillColor("#666").text(`Pedido: ${orderName}`).fillColor("#000");
    doc.moveDown();

    if (dobo.previewBuf) {
      doc.text("Vista previa combinada:", { underline: true });
      doc.moveDown(0.25);
      try { doc.image(dobo.previewBuf, { fit: [520, 320] }); } catch {}
      doc.moveDown();
    }

    if (dobo.layerBuf) {
      doc.text("Capa de diseño (PNG transparente):", { underline: true });
      doc.moveDown(0.25);
      try { doc.image(dobo.layerBuf, { fit: [380, 280] }); } catch {}
      doc.moveDown();
    }

    doc.text("Especificaciones:", { underline: true });
    const spec = [
      ["Planta", dobo.plantTitle || "-"],
      ["Maceta", dobo.potTitle || "-"],
      ["Color", dobo.color || "-"],
      ["Tamaño", dobo.size || "-"],
      ["Design ID", dobo.designId || "-"],
    ];
    doc.moveDown(0.25);
    spec.forEach(([k, v]) => doc.fontSize(11).text(`${k}: ${v}`));
    doc.moveDown();

    if (accessories?.length) {
      doc.text("Accesorios:", { underline: true });
      accessories.forEach((t) => doc.fontSize(11).text(`• ${t}`));
      doc.moveDown();
    }

    if (dobo.previewUrl || dobo.layerUrl) {
      doc.text("Enlaces técnicos:", { underline: true });
      if (dobo.previewUrl) doc.fontSize(10).fillColor("#0a61ff").text(dobo.previewUrl);
      if (dobo.layerUrl) doc.fontSize(10).fillColor("#0a61ff").text(dobo.layerUrl);
      doc.fillColor("#000");
    }

    doc.end();
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    if (FLOW_SECRET) {
      const got = req.headers["x-flow-secret"];
      if (!got || got !== FLOW_SECRET) return res.status(401).json({ error: "Unauthorized" });
    }

    const order = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!order || !order.line_items) return res.status(400).json({ error: "Order JSON inválido" });

    const lines = order.line_items;

    const isAcc = (li) =>
      (li.properties || []).some((p) => (p.name || p.key) === "_Accessory" && p.value === "true");

    const notAcc = lines.filter((li) => !isAcc(li));
    const doboLine =
      notAcc.find((li) =>
        (li.properties || []).some((p) => (p.name || p.key) === "_LinePriority" && p.value === "0")
      ) || notAcc[0];

    if (!doboLine) return res.status(400).json({ error: "No se encontró línea DOBO" });

    const getProp = (li, name) => {
      const n = name.toLowerCase();
      const p = (li.properties || []).find((pr) => {
        const k = (pr.name || pr.key || "").toLowerCase();
        return k === n || k === `_${n}`;
      });
      return p ? p.value : "";
    };

    const previewUrl = getProp(doboLine, "DesignPreview");
    const layerUrl   = getProp(doboLine, "DesignLayer") || getProp(doboLine, "DesignLayerUrl");
    const designId   = getProp(doboLine, "DesignId");
    const color      = getProp(doboLine, "DesignColor");
    const size       = getProp(doboLine, "DesignSize");

    const accessories = lines.filter(isAcc).map((li) => li.title).filter(Boolean);

    let previewBuf = null, layerBuf = null;
    if (previewUrl) { try { previewBuf = await fetchAsBuffer(previewUrl); } catch {} }
    if (layerUrl)   { try { layerBuf = await fetchAsBuffer(layerUrl);   } catch {} }

    const dobo = {
      previewUrl, layerUrl, previewBuf, layerBuf,
      plantTitle: doboLine?.product_title?.includes("+")
        ? doboLine.product_title.split("+")[0].trim() : "",
      potTitle: doboLine?.product_title?.includes("+")
        ? doboLine.product_title.split("+")[1]?.trim() : "",
      color, size, designId,
    };

    const pdfBuffer = await buildPdfBuffer({
      orderName: order.name || order.order_number || "",
      dobo,
      accessories,
    });

    let pdfUrl = "";
    try { pdfUrl = await uploadPdfToCloudinary(pdfBuffer, `dobo-order-${Date.now()}`); } catch {}

    // ---- Gmail (Nodemailer) ----
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !TO_EMAIL) {
      return res.status(200).json({ ok: true, warn: "Faltan GMAIL_USER/GMAIL_APP_PASSWORD/MERCHANT_NOTIF_EMAIL", pdfUrl });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });

    const attachments = [];
    if (pdfBuffer) attachments.push({ filename: "dobo-resumen.pdf", content: pdfBuffer, contentType: "application/pdf" });
    if (dobo.layerBuf) attachments.push({ filename: "dobo-design-layer.png", content: dobo.layerBuf, contentType: "image/png" });
    if (dobo.previewBuf) attachments.push({ filename: "dobo-preview.png", content: dobo.previewBuf, contentType: "image/png" });

    await transporter.sendMail({
      from: `"DOBO" <${GMAIL_USER}>`,
      to: TO_EMAIL,
      subject: `DOBO - Pedido ${order.name || order.id}`,
      text: `Se adjuntan resumen PDF y assets. PDF: ${pdfUrl || "(adjunto)"}`,
      html: `<p>Se adjuntan resumen PDF y assets.</p>${pdfUrl ? `<p>PDF: <a href="${pdfUrl}">${pdfUrl}</a></p>` : ""}`,
      attachments,
    });

    return res.status(200).json({ ok: true, pdfUrl });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
