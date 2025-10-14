// lib/checkoutHelpers.js
export function getShopDomain() {
  if (typeof window !== "undefined") {
    try {
      const url = new URL(window.location.href);
      const qsShop = url.searchParams.get("shop") || url.searchParams.get("shopDomain");
      if (qsShop) return qsShop.replace(/^https?:\/\//, "").replace(/\/$/, "");
    } catch {}
    try {
      if (window.Shopify && window.Shopify.shop) return String(window.Shopify.shop);
    } catch {}
    try {
      if (document.referrer) {
        const h = new URL(document.referrer).host;
        if (h) return h;
      }
    } catch {}
  }
  const env = process.env.NEXT_PUBLIC_SHOP_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN || process.env.SHOP_DOMAIN || process.env.SHOPIFY_STORE_DOMAIN;
  if (env) return String(env).replace(/^https?:\/\//, "").replace(/\/$/, "");
  return "example.myshopify.com";
}

export function toNumericId(id) {
  const s = String(id || "");
  if (/^\d+$/.test(s)) return s;
  if (s.includes("gid://")) return s.split("/").pop();
  const m = s.match(/(\d+)/);
  return m ? m[1] : s;
}
