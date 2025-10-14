// lib/shopDomain.js
// Resuelve el dominio de Shopify seguro para cliente.

const BAD_HOSTS = ["vercel.app", "vercel.com", "localhost", "127.0.0.1"];

function sanitize(d) {
  return String(d || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/g, "")
    .toLowerCase();
}

const FALLBACK = "um7xus-0u.myshopify.com";

export function getShopDomain(debug = false) {
  // 1) Env públicos (compilados en el bundle)
  const env1 = sanitize(process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN);
  const env2 = sanitize(process.env.NEXT_PUBLIC_SHOP_DOMAIN);
  let domain = env1 || env2;

  // 2) Si no hay env, permitir QS/referrer SOLO si terminan en .myshopify.com
  if (!domain && typeof window !== "undefined") {
    let fromQS = "";
    let refHost = "";
    try {
      const qs = new URLSearchParams(window.location.search);
      const q = qs.get("shop") || qs.get("shopDomain");
      if (q && q.toLowerCase().endsWith(".myshopify.com")) fromQS = sanitize(q);
    } catch {}
    try {
      if (document.referrer) {
        const h = new URL(document.referrer).host;
        if (h && h.toLowerCase().endsWith(".myshopify.com")) refHost = sanitize(h);
      }
    } catch {}
    domain = fromQS || refHost || "";
  }

  // 3) Fallback duro
  if (!domain) domain = FALLBACK;

  // 4) Bloqueo de hosts malos
  if (BAD_HOSTS.some((bad) => domain.endsWith(bad))) domain = FALLBACK;

  if (debug && typeof window !== "undefined") {
    console.log("[DOBO:getShopDomain]", {
      env1, env2, resolved: domain,
      location: window.location?.host,
      referrer: document.referrer || null
    });
  }
  return domain;
}
