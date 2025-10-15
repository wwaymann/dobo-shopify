// lib/shopDomain.js
// Resuelve el dominio de Shopify para el cliente (Next.js lado navegador)

const BAD_HOSTS = ["vercel.app", "vercel.com", "localhost", "127.0.0.1"];

function sanitize(d) {
  return String(d || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/g, "")
    .toLowerCase();
}

export function getShopDomain() {
  // 1) Variables expuestas al cliente (prefijo NEXT_PUBLIC_)
  let domain =
    sanitize(process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN) ||
    sanitize(process.env.NEXT_PUBLIC_SHOP_DOMAIN);

  // 2) Si no hay env, probar querystring o referrer (solo en cliente)
  if (typeof window !== "undefined") {
    try {
      const qs = new URLSearchParams(window.location.search);
      const fromQS = qs.get("shop") || qs.get("shopDomain");
      if (!domain && fromQS) domain = sanitize(fromQS);
    } catch {}
    try {
      if (!domain && document.referrer) {
        const h = new URL(document.referrer).host;
        if (h) domain = sanitize(h);
      }
    } catch {}
  }

  // 3) Fallback duro (usa el tuyo conocido)
  if (!domain) domain = "um7xus-0u.myshopify.com";

  // 4) Bloqueos de seguridad: NUNCA a vercel.* ni a localhost
  if (BAD_HOSTS.some((bad) => domain.endsWith(bad))) {
    domain = "um7xus-0u.myshopify.com";
  }

  return domain;
}
