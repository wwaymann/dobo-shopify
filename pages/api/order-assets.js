// pages/api/order-assets.js
import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";

export const config = { api: { bodyParser: { sizeLimit: "25mb" } } };

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UNSIGNED_PRESET;
const TO_EMAIL = process.env.MERCHANT_NOTIF_EMAIL;
const FLOW_SECRET = process.env.ORDER_FLOW_SECRET;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

// ---------- Utils ----------
const isHttp = (s="") => /^https?:\/\//i.test(s);
const isData = (s="") => /^data:([^;]+);base64,/i.test(s);
const inferCT = (name="") => {
  const n = name.toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".svg")) return "image/svg+xml";
  if (n.endsWith(".json")) return "application/json";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
};

function dataUrlToBuf(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl || "");
  if (!m) return null;
  const [, ct, b64] = m;
  return { buf: Buffer.from(b64, "base64"), ct };
}

async function fetchAsBufOrDataUrl(ref, filenameHint="file.bin") {
  if (!ref) return null;
  if (isData(ref)) {
    const x = dataUrlToBuf(ref);
    if (!x) return null;
    return { filename: filenameHint, content: x.buf, contentType: x.ct };
  }
  if (isHttp(ref)) {
    const r = await fetch(ref);
    if (!r.ok) throw new Error(`No se pudo bajar: ${ref} -> ${r.status}`);
    const arr = await r.arrayBuffer();
    const buf = Buffer.from(arr);
    const ct = r.headers.get("content-type") || inferCT(filenameHint || ref);
    const name = filenameHint || (ref.split("?")[0].split("/").pop() || "file.bin");
    return { filename: name, content: buf, contentType: ct };
  }
  // base64 crudo o texto
  const isB64 = /^[A-Za-z0-9+/=\s]+$/.test(String(ref)) && String(ref).length > 60;
  if (isB64) return { filename: filenameHint, content: Buffer.from(String(ref).replace(/\s+/g, ""), "base64"), contentType: inferCT(filenameHint) };
  return { filename: filenameHint, content: Buffer.from(String(ref), "utf8"), contentType: inferCT(filenameHint) };
}

async function uploadPdfToCloudinary(pdfBuffer, publicId) {
  if (!CLOUD || !PRESET) return "";
  const form = new FormData();
  form.append("file", new Blob([pdfBuffer]), `${publicId}.pdf`);
  form.append("upload_preset", PRESET);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/raw/upload`, { method: "POST", body: form });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || "Error Cloudinary RAW");
  return j.secure_url || j.url || "";
}

function getProp(li, name) {
  const n = name.toLowerCase();
  const p = (li.properties || []).find(pr => {
    const k = (pr.name || pr.key || "").toLowerCase();
    return k === n || k === `_${n}`;
  });
  return p ? p.value : "";
}

const isAccessory = (li) => (li.properties || []).some(p => (p.name || p.key) === "_Accessory" && p.value === "true");

// ---------- PDF resumen sencillo ----------
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

    if (dobo.layerAllBuf) {
      doc.text("Capa de diseño (PNG transparente):", { underline: true });
      doc.moveDown(0.25);
      try { doc.image(dobo.layerAllBuf, { fit: [380, 280] }); } catch {}
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

    if (dobo.previewUrl || dobo.layerAllUrl) {
      doc.text("Enlaces técnicos:", { underline: true });
      if (dobo.previewUrl) doc.fontSize(10).fillColor("#0a61ff").text(dobo.previewUrl);
      if (dobo.layerAllUrl) doc.fontSize(10).fillColor("#0a61ff").text(dobo.layerAllUrl);
      doc.fillColor("#000");
    }

    doc.end();
  });
}

// ---------- Handler ----------
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
    const coreLines = lines.filter(li => !isAccessory(li));
    const doboLine =
      coreLines.find(li => (li.properties || []).some(p => (p.name || p.key) === "_LinePriority" && p.value === "0"))
      || coreLines[0];

    if (!doboLine) return res.status(400).json({ error: "No se encontró línea DOBO" });

    // Lectura flexible de propiedades
    // Previews
    const previewUrl =
      getProp(doboLine, "DesignPreview") ||
      getProp(doboLine, "dobo_preview_url");

    // Capas: una general y específicas
    const layerAllUrl =
      getProp(doboLine, "DesignLayer") ||
      getProp(doboLine, "DesignLayerUrl") ||
      getProp(doboLine, "dobo_layer_all_url");

    const layerTextUrl  = getProp(doboLine, "dobo_layer_text_url");
    const layerImageUrl = getProp(doboLine, "dobo_layer_image_url");

    // Manifest JSON opcional [{name,url}]
    let layersManifest = [];
    const manifestRaw = getProp(doboLine, "dobo_layers_manifest");
    if (manifestRaw) {
      try { layersManifest = JSON.parse(manifestRaw); } catch {}
    }

    // SVG / JSON del diseño
    const designSvg =
      getProp(doboLine, "dobo_design_svg") ||
      getProp(doboLine, "dobo_design_svg_b64");

    const designJson =
      getProp(doboLine, "dobo_design_json") ||
      getProp(doboLine, "dobo_design_json_b64") ||
      getProp(doboLine, "dobo_design_json_url");

    const color = getProp(doboLine, "DesignColor");
    const size  = getProp(doboLine, "DesignSize");
    const designId = getProp(doboLine, "DesignId");

    const accessories = lines.filter(isAccessory).map(li => li.title).filter(Boolean);

    // Descargas buffers para PDF rápido
    let previewBuf = null, layerAllBuf = null;
    if (previewUrl)  { try { const a = await fetchAsBufOrDataUrl(previewUrl, "preview.png");  previewBuf  = a?.content || null; } catch {} }
    if (layerAllUrl) { try { const a = await fetchAsBufOrDataUrl(layerAllUrl, "layer-all.png"); layerAllBuf = a?.content || null; } catch {} }

    // Datos DOBO para PDF
    const dobo = {
      previewUrl, layerAllUrl, previewBuf, layerAllBuf,
      plantTitle: doboLine?.product_title?.includes("+") ? doboLine.product_title.split("+")[0].trim() : "",
      potTitle:   doboLine?.product_title?.includes("+") ? doboLine.product_title.split("+")[1]?.trim() : "",
      color, size, designId,
    };

    const pdfBuffer = await buildPdfBuffer({
      orderName: order.name || order.order_number || "",
      dobo,
      accessories,
    });

    let pdfUrl = "";
    try { if (pdfBuffer) pdfUrl = await uploadPdfToCloudinary(pdfBuffer, `dobo-order-${Date.now()}`); } catch {}

    // ---- Construye adjuntos finales ----
    const attachments = [];

    // PDF
    if (pdfBuffer) attachments.push({ filename: "dobo-resumen.pdf", content: pdfBuffer, contentType: "application/pdf" });

    // Preview y capa general
    if (previewBuf) attachments.push({ filename: "preview.png", content: previewBuf, contentType: "image/png" });
    if (layerAllBuf) attachments.push({ filename: "layer-all.png", content: layerAllBuf, contentType: "image/png" });

    // Capas específicas
    const layerRefs = [
      { ref: layerTextUrl,  name: "layer-text.png" },
      { ref: layerImageUrl, name: "layer-image.png" },
    ];
    for (const { ref, name } of layerRefs) {
      if (!ref) continue;
      try {
        const a = await fetchAsBufOrDataUrl(ref, name);
        if (a?.content) attachments.push({ filename: name, content: a.content, contentType: a.contentType || inferCT(name) });
      } catch {}
    }

    // Manifest de capas
    for (const L of layersManifest) {
      if (!L?.url) continue;
      const name = L.name || (L.url.split("?")[0].split("/").pop() || "layer.png");
      try {
        const a = await fetchAsBufOrDataUrl(L.url, name);
        if (a?.content) attachments.push({ filename: name, content: a.content, contentType: a.contentType || inferCT(name) });
      } catch {}
    }

    // SVG
    if (designSvg) {
      try {
        const a = await fetchAsBufOrDataUrl(designSvg, "design.svg");
        if (a?.content) attachments.push({ filename: "design.svg", content: a.content, contentType: a.contentType || "image/svg+xml" });
      } catch {}
    }

    // JSON
    if (designJson) {
      try {
        const a = await fetchAsBufOrDataUrl(designJson, "design.json");
        if (a?.content) attachments.push({ filename: "design.json", content: a.content, contentType: a.contentType || "application/json" });
      } catch {}
    }

    // ---- Envío por correo (Gmail) ----
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !TO_EMAIL) {
      return res.status(200).json({
        ok: true,
        warn: "Faltan GMAIL_USER/GMAIL_APP_PASSWORD/MERCHANT_NOTIF_EMAIL",
        pdfUrl,
        attached: attachments.length
      });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });

    const lineRows = (order.line_items || []).map((li, i) => {
      const props = (li.properties || []).map(p => `<div><b>${p.name || p.key}:</b> ${p.value}</div>`).join("");
      return `<tr>
        <td style="padding:6px;border:1px solid #ddd;">${i + 1}</td>
        <td style="padding:6px;border:1px solid #ddd;">${li.title}</td>
        <td style="padding:6px;border:1px solid #ddd;">${li.variant_title || ""}</td>
        <td style="padding:6px;border:1px solid #ddd;">${li.quantity}</td>
        <td style="padding:6px;border:1px solid #ddd;">${props}</td>
      </tr>`;
    }).join("");

    const html = `
      <p>Pedido ${order.name || order.order_number || order.id}.</p>
      <p>Adjuntos: ${attachments.length}${pdfUrl ? ` · PDF: <a href="${pdfUrl}">${pdfUrl}</a>` : ""}</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead><tr>
          <th style="padding:6px;border:1px solid #ddd;">#</th>
          <th style="padding:6px;border:1px solid #ddd;">Producto</th>
          <th style="padding:6px;border:1px solid #ddd;">Variante</th>
          <th style="padding:6px;border:1px solid #ddd;">Cant.</th>
          <th style="padding:6px;border:1px solid #ddd;">Props</th>
        </tr></thead>
        <tbody>${lineRows}</tbody>
      </table>
    `;

    await transporter.sendMail({
      from: `"DOBO" <${GMAIL_USER}>`,
      to: TO_EMAIL,
      subject: `DOBO – Activos de edición · ${order.name || order.id}`,
      html,
      text: `Adjuntos: ${attachments.length}. PDF: ${pdfUrl || "(adjunto)"}`,
      attachments,
    });

    return res.status(200).json({ ok: true, pdfUrl, attached: attachments.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
