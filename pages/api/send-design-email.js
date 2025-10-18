// pages/api/send-design-email.js
// Envío robusto de correo + adjuntos por URL (Cloudinary/CDN) con Gmail (nodemailer)

export const config = {
  api: { bodyParser: { sizeLimit: "2mb" } }, // permite payload pequeño para beacon/keepalive
};

const MAX_ATTACHMENT = 7 * 1024 * 1024; // ~7MB por adjunto
const ALLOWED_HOSTS = new Set([
  "res.cloudinary.com",
  "cdn.shopify.com",
  "static.shopify.com",
  "images.shopifycdn.com",
  "image.shopifycdn.net",
  "cdn.shopifycdn.net",
  "dobo.cl",
  "www.dobo.cl",
]);

function isHttpsUrl(x) {
  try {
    const u = new URL(String(x));
    if (u.protocol !== "https:") return false;
    if (ALLOWED_HOSTS.has(u.hostname)) return true;
    // permitir subdominios comunes (cloudinary subdomain / shopify cdn)
    if (u.hostname.endsWith(".res.cloudinary.com")) return true;
    if (u.hostname.endsWith(".shopifycdn.com")) return true;
    return false;
  } catch {
    return false;
  }
}

function pickCandidateUrlsFromAttrs(attrs = [], { attachPreviews = false, attachAll = false } = {}) {
  const urls = [];
  for (const a of Array.isArray(attrs) ? attrs : []) {
    const key = String(a?.key || "").trim();
    const val = String(a?.value || "").trim();
    if (!val || !isHttpsUrl(val)) continue;

    if (attachAll) {
      urls.push(val);
      continue;
    }
    // heurística de "preview/capas"
    const lk = key.toLowerCase();
    const isPreview =
      lk.includes("designpreview") ||
      lk === "preview" ||
      lk.endsWith(":preview") ||
      lk.includes("preview_url") ||
      lk.startsWith("layer:") || // capas
      lk.startsWith("capa:");    // por si lo nombras en español

    if (attachPreviews && isPreview) urls.push(val);
  }
  // dedupe
  return Array.from(new Set(urls));
}

function filenameFromUrl(u) {
  try {
    const p = new URL(u).pathname;
    const base = p.split("/").pop() || "file";
    return base.split("?")[0] || "file";
  } catch {
    return "file";
  }
}

async function fetchAsAttachment(url) {
  const r = await fetch(url, { redirect: "follow", cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const ct = r.headers.get("content-type") || "application/octet-stream";
  const cl = Number(r.headers.get("content-length") || 0);
  if (cl && cl > MAX_ATTACHMENT) throw new Error(`too big (header): ${cl}`);
  const ab = await r.arrayBuffer();
  if (ab.byteLength > MAX_ATTACHMENT) throw new Error(`too big (body): ${ab.byteLength}`);
  return {
    filename: filenameFromUrl(url),
    content: Buffer.from(ab),
    contentType: ct,
  };
}

function buildHtml({ meta = {}, links = {}, attrs = [] } = {}) {
  const esc = (s) => String(s ?? "").replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m]));
  const metaRows = Object.entries(meta)
    .map(([k, v]) => `<tr><td style="padding:4px 8px"><b>${esc(k)}</b></td><td style="padding:4px 8px">${esc(v)}</td></tr>`)
    .join("");
  const linkRows = Object.entries(links)
    .map(([k, v]) => `<tr><td style="padding:4px 8px"><b>${esc(k)}</b></td><td style="padding:4px 8px"><a href="${esc(v)}">${esc(v)}</a></td></tr>`)
    .join("");
  const attrsPre = esc(JSON.stringify(attrs, null, 2));
  return `
    <div style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial">
      <h2>Nuevo diseño DOBO</h2>
      <p><small>Fecha: ${new Date().toISOString()}</small></p>
      ${metaRows ? `<table border="0" cellspacing="0" cellpadding="0">${metaRows}</table>` : ""}
      ${linkRows ? `<h3>Links</h3><table border="0" cellspacing="0" cellpadding="0">${linkRows}</table>` : ""}
      <h3>Attrs</h3>
      <pre style="background:#f7f7f7;padding:12px;border-radius:8px;border:1px solid #eee">${attrsPre}</pre>
      <p style="color:#888">Adjuntos: si el correo no trae archivos, revisa que las URLs sean HTTPS, de un host permitido, y &lt; 7MB.</p>
    </div>
  `;
}

function buildText({ meta = {}, links = {}, attrs = [] } = {}) {
  const metaTxt = Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join("\n");
  const linkTxt = Object.entries(links).map(([k, v]) => `${k}: ${v}`).join("\n");
  return [
    "Nuevo diseño DOBO",
    `Fecha: ${new Date().toISOString()}`,
    metaTxt && `\n${metaTxt}`,
    linkTxt && `\nLinks:\n${linkTxt}`,
    "\nAttrs:",
    JSON.stringify(attrs, null, 2),
  ]
    .filter(Boolean)
    .join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { GMAIL_USER, GMAIL_APP_PASSWORD, MERCHANT_NOTIF_EMAIL } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return res.status(500).json({ ok: false, error: "Missing Gmail env (GMAIL_USER/GMAIL_APP_PASSWORD)" });
  }

  try {
    const { attrs = [], meta = {}, links = {}, attachPreviews = false, attachAll = false, to } = req.body || {};

    // Seleccionar URLs candidatas desde attrs
    const urlList = pickCandidateUrlsFromAttrs(attrs, { attachPreviews, attachAll });

    // Descargar adjuntos (tolerante a fallos)
    const attachments = [];
    for (const u of urlList) {
      try {
        attachments.push(await fetchAsAttachment(u));
      } catch (err) {
        console.warn("[email] skip attachment:", u, "-", err?.message || err);
      }
    }

    // Enviar correo
    const nodemailer = (await import("nodemailer")).default;
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });

    const subject =
      `Nuevo diseño DOBO — ${meta?.Descripcion || meta?.description || ""}`.trim() || "Nuevo diseño DOBO";

    const info = await transporter.sendMail({
      from: `"DOBO Bot" <${GMAIL_USER}>`,
      to: to || MERCHANT_NOTIF_EMAIL || GMAIL_USER,
      subject,
      text: buildText({ meta, links, attrs }),
      html: buildHtml({ meta, links, attrs }),
      attachments,
    });

    return res.json({ ok: true, id: info.messageId, attachments: attachments.length });
  } catch (e) {
    console.error("[email] error:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
