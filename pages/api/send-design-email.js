// pages/api/send-design-email.js
import nodemailer from "nodemailer";
import dns from "dns";

dns.setDefaultResultOrder?.("ipv4first"); // reduce ENOTFOUND por IPv6

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[c]));
}

const ALLOW_ATTACH_HOSTS = (process.env.ALLOW_ATTACH_HOSTS || "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

// helper: descarga segura con timeout, o null
async function downloadAsBuffer(url, timeoutMs = 10000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const r = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || undefined;
    const b  = Buffer.from(await r.arrayBuffer());
    return { buffer: b, contentType: ct };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method-not-allowed" });

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const defaultTo = process.env.MERCHANT_NOTIF_EMAIL || user;

  if (!user || !pass || !defaultTo) {
    return res.status(500).json({ ok: false, error: "Missing env: GMAIL_USER / GMAIL_APP_PASSWORD / MERCHANT_NOTIF_EMAIL" });
  }

  const { attrs = [], meta = {}, links = {}, to, attachAll = false, attachPreviews = false } = req.body || {};
  const lower = s => String(s || "").toLowerCase();
  const isUrl  = v => typeof v === "string" && /^https?:\/\//i.test(v);

  // Solo embebemos en HTML; adjuntos son opcionales
  const previews = (attrs || []).filter(a =>
    lower(a?.key).includes("preview") || lower(a?.key).includes("thumb")
  );

  // set de URLs candidatas a adjuntar
  let candidateUrls = [];
  if (attachPreviews) {
    candidateUrls.push(...previews.map(a => a?.value).filter(isUrl));
  }
  if (attachAll) {
    candidateUrls.push(
      ...(attrs || [])
        .filter(a => isUrl(a?.value) && (lower(a?.key).includes("layer") || lower(a?.value).endsWith(".png")))
        .map(a => a.value)
    );
  }

  // Allowlist de hosts para adjuntar
  candidateUrls = candidateUrls.filter(u => {
    try {
      const host = new URL(u).hostname.toLowerCase();
      if (ALLOW_ATTACH_HOSTS.length === 0) return false; // si no configuras allowlist, no adjuntamos nada
      return ALLOW_ATTACH_HOSTS.some(allowed => host.endsWith(allowed));
    } catch {
      return false;
    }
  });

  // Descarga concurrente (limitada) de adjuntos
  const attachments = [];
  for (const u of candidateUrls.slice(0, 10)) {
    const got = await downloadAsBuffer(u, 10000);
    if (got?.buffer?.length) {
      const host = new URL(u).hostname;
      attachments.push({
        filename: `${host.replace(/\W+/g, "_")}_${attachments.length + 1}.png`,
        content: got.buffer,
        contentType: got.contentType || "image/png",
      });
    }
  }

  const html = `
    <h2>Nuevo diseño DOBO</h2>
    <p><b>Fecha:</b> ${new Date().toISOString()}</p>
    ${Object.entries(meta).map(([k, v]) => `<p><b>${escapeHtml(k)}:</b> ${escapeHtml(String(v))}</p>`).join("")}
    ${Object.entries(links).map(([k, v]) => `<p><a href="${escapeHtml(String(v))}">${escapeHtml(k)}</a></p>`).join("")}
    ${previews.length ? `<p><img src="${escapeHtml(String(previews[0].value))}" style="max-width:520px" /></p>` : ""}
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
      // Solo adjuntamos si realmente pudimos descargarlos
      attachments: attachments.length ? attachments : undefined,
    });

    return res.status(200).json({ ok: true, id: info?.messageId || null, attachments: attachments.length });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
