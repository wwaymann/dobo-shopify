// lib/shopDomain.js
const BAD_HOSTS = ["vercel.app", "vercel.com", "localhost", "127.0.0.1"];

function sanitize(d) {
  return String(d || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/g, "")
    .toLowerCase();
}

export function getShopDomain() {
  let domain =
    sanitize(process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN) ||
    sanitize(process.env.NEXT_PUBLIC_SHOP_DOMAIN) ||
    sanitize(process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN);

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

  if (!domain) domain = "um7xus-0u.myshopify.com";
  if (BAD_HOSTS.some((bad) => domain.endsWith(bad))) domain = "um7xus-0u.myshopify.com";
  return domain;
}
