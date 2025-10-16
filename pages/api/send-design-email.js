// pages/api/send-design-email.js
// Runtime Node.js (NO Edge)
export const config = { api: { bodyParser: true } };

import nodemailer from "nodemailer";

// Pequeña utilidad de fetch con timeout y follow
async function fetchToBuffer(url, { timeoutMs = 12000 } = {}) {
  const ctrl = AbortController ? new AbortController() : null;
  const id = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctrl?.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const ct = res.headers.get("content-type") || "application/octet-stream";
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    return { ok: true, buf, contentType: ct };
  } finally {
    if (id) clearTimeout(id);
  }
}

function normStr(v) {
  return (v ?? "").toString();
}

function pickAttachments(attrs = [], { attachPreviews = false, attachAll = false, maxBytes = 7 * 1024 * 1024 }) {
  // Reglas:
  // - Siempre: keys que empiecen por "Layer:" (capas)
  // - Si attachPreviews: "DesignPreview"
  // - attachAll: adjunta cualquier key con URL http(s)
  const plan = [];
  for (const a of Array.isArray(attrs) ? attrs : []) {
    const key = normStr(a?.key).trim();
    const val = normStr(a?.value).trim();
    const lk = key.toLowerCase();

    const looksUrl = /^https?:\/\//i.test(val);
    if (!looksUrl) continue;

    const isLayer = lk.startsWith("layer:");
    const isPreview = lk.includes("designpreview");

    if (attachAll || isLayer || (attachPreviews && isPreview)) {
      plan.push({ key, url: val });
    }
  }

  return {
    async build() {
      const files = [];
      for (const { key, url } of plan) {
        try {
          const { ok, buf, contentType } = await fetchToBuffer(url);
          if (!ok) throw new Error("download-failed");
          if (buf.length > maxBytes) {
            console.warn(`[email] skip ${key}: too big (${buf.length} bytes)`);
            continue;
          }
          const ext =
            (/image\/(\w+)/i.exec(contentType)?.[1] ||
              (/\/pdf$/i.test(contentType) ? "pdf" : "bin"));
          const filename =
            key.replace(/\W+/g, "_").replace(/^_+/, "") || "file";
          files.push({
            filename: `${filename}.${ext}`,
            content: buf,
            contentType,
          });
        } catch (e) {
          console.warn(`[email] attach fail for ${key}:`, e?.message || e);
        }
      }
      return files;
    },
    planned: plan, // para listarlos en HTML si no pudieron adjuntarse
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const {
      attrs = [],
      meta = {},
      links = {},
      attachPreviews = false,
      attachAll = false,
    } = (req.body || {});

    const GMAIL_USER = process.env.GMAIL_USER;
    const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
    const TO = process.env.MERCHANT_NOTIF_EMAIL || GMAIL_USER;

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      return res.status(500).json({ ok: false, error: "SMTP env missing" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });

    const attPlan = pickAttachments(attrs, { attachPreviews, attachAll });
    const attachments = await attPlan.build();

    // Texto/HTML del correo
    const when = new Date().toISOString();
    const subject =
      `Nuevo diseño DOBO – ${normStr(meta?.Descripcion) || when}`;

    const attrsList = JSON.stringify(attrs, null, 2);
    const metaList = JSON.stringify(meta, null, 2);
    const linksList = Object.entries(links || {})
      .map(([k, v]) => `<div><b>${k}:</b> <a href="${v}">${v}</a></div>`)
      .join("");

    const plannedLinks = attPlan.planned
      .map(p => `<li><a href="${p.url}">${p.key}</a></li>`)
      .join("");

    const html = `
      <div style="font: 14px/1.45 system-ui,Segoe UI,Roboto,Arial,sans-serif">
        <h2>Nuevo diseño DOBO</h2>
        <div><b>Fecha:</b> ${when}</div>
        ${meta?.Descripcion ? `<div><b>Descripción:</b> ${meta.Descripcion}</div>` : ""}
        ${meta?.Precio ? `<div><b>Precio:</b> ${meta.Precio}</div>` : ""}
        ${linksList ? `<h3>Links</h3>${linksList}` : ""}

        ${attachments.length ? `<h3>Adjuntos</h3><div>Se adjuntaron ${attachments.length} archivo(s).</div>` : ""}
        ${plannedLinks && !attachments.length ? `<h3>Capas/Previews</h3><ul>${plannedLinks}</ul>` : ""}

        <h3>Attrs</h3>
        <pre>${attrsList}</pre>
        <h3>Meta</h3>
        <pre>${metaList}</pre>
      </div>`.trim();

    const text = [
      "Nuevo diseño DOBO",
      `Fecha: ${when}`,
      meta?.Descripcion ? `Descripcion: ${meta.Descripcion}` : "",
      meta?.Precio ? `Precio: ${meta.Precio}` : "",
      attachments.length ? `Adjuntos: ${attachments.length}` : "",
    ].filter(Boolean).join("\n");

    const info = await transporter.sendMail({
      from: `"DOBO Bot" <${GMAIL_USER}>`,
      to: TO,
      subject,
      text,
      html,
      attachments,
    });

    console.log("[email] sent:", info?.messageId, "attachments:", attachments.length);
    return res.status(200).json({
      ok: true,
      id: info?.messageId || null,
      attachments: attachments.length,
    });
  } catch (e) {
    console.error("[email] error:", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
