// lib/shopDomain.js
export function getShopDomain() {
  // 1) lee querystring / referrer / window.Shopify si hay navegador
  if (typeof window !== "undefined") {
    try {
      const qs = new URLSearchParams(window.location.search);
      const fromQS = qs.get("shopDomain");
      if (fromQS) return String(fromQS).replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (window.Shopify?.shop) return String(window.Shopify.shop);
      if (document.referrer) {
        const h = new URL(document.referrer).host;
        if (h) return h;
      }
    } catch {}
  }
  // 2) variables de entorno *públicas* primero
  const env =
    process.env.NEXT_PUBLIC_SHOP_DOMAIN ||
    process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ||
    process.env.NEXT_PUBLIC_SHOPIFY_STORE ||
    // 3) como último recurso, la privada (queda inlined en build si existe)
    process.env.SHOPIFY_SHOP ||
    "um7xus-0u.myshopify.com";

  return String(env).replace(/^https?:\/\//, "").replace(/\/$/, "");
}
