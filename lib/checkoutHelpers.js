// lib/checkoutHelpers.js
export const getShopDomain = () => {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_SHOP_DOMAIN || '';
  try {
    if (window.Shopify && window.Shopify.shop) return window.Shopify.shop;
    const qs = new URLSearchParams(window.location.search);
    const fromQS = qs.get('shopDomain') || qs.get('shop');
    if (fromQS) return fromQS;
    if (document.referrer) {
      const h = new URL(document.referrer).host;
      if (h.endsWith('.myshopify.com')) return h;
    }
    return process.env.NEXT_PUBLIC_SHOP_DOMAIN || 'um7xus-0u.myshopify.com';
  } catch {
    return process.env.NEXT_PUBLIC_SHOP_DOMAIN || 'um7xus-0u.myshopify.com';
  }
};

export const toNumericId = (id) => {
  const s = String(id || '');
  const n = s.includes('gid://') ? s.split('/').pop() : s;
  return /^\d+$/.test(n) ? n : '';
};

export async function createDesignProductSafe(payload) {
  const res = await fetch("/api/design-product", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { ok: false, error: text || `HTTP ${res.status}` }; }

  const details =
    json?.error ||
    (Array.isArray(json?.userErrors) && json.userErrors.map(e => e?.message).join("; ")) ||
    (Array.isArray(json?.errors) && json.errors.map(e => e?.message).join("; ")) ||
    (json?.extensions?.value || json?.message) ||
    (!res.ok && `HTTP ${res.status}`) ||
    "";

  if (!res.ok || !json?.variantId) {
    throw new Error(details ? `shopify-graphql-error: ${details}` : "shopify-graphql-error");
  }
  return json;
}
