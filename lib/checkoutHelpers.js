// lib/checkoutHelpers.js
export function toNumericId(id) {
  const s = String(id || "");
  return s.includes("gid://") ? s.split("/").pop() : s;
}
export function getShopDomain() {
  if (typeof window !== "undefined") {
    try {
      const qs = new URLSearchParams(window.location.search);
      const fromQS = qs.get("shopDomain") || qs.get("shop") || qs.get("shop_url");
      if (fromQS) return fromQS.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    } catch {}
    try { if (window.Shopify && window.Shopify.shop) return String(window.Shopify.shop); } catch {}
    try {
      if (document.referrer) {
        const h = new URL(document.referrer).host;
        if (/myshopify\.com$/.test(h)) return h;
      }
    } catch {}
  }
  if (process && process.env && process.env.NEXT_PUBLIC_SHOP_DOMAIN) {
    return String(process.env.NEXT_PUBLIC_SHOP_DOMAIN);
  }
  return "example.myshopify.com";
}
export async function createDesignProductSafe(payload) {
  const norm = { ...payload };
  if (norm.price != null) norm.price = String(norm.price);
  try {
    const r = await fetch("/api/design-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(norm),
    });
    const raw = await r.text();
    let j; try { j = JSON.parse(raw); } catch { j = { ok:false, error: raw }; }
    if (!r.ok || !j?.variantId) {
      const msg = j?.error || `HTTP ${r.status}`;
      return { ok: false, error: msg };
    }
    return { ok: true, variantId: j.variantId, data: j };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
