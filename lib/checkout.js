// lib/checkout.js
import { getShopDomain } from "./shopDomain";

export const toGid = (id) => {
  const s = String(id || "");
  if (s.startsWith("gid://")) return s;
  const numeric = s.replace(/\D/g, "");
  return `gid://shopify/ProductVariant/${numeric}`;
};

// Crea un carrito con Storefront API y redirige al checkoutUrl
export async function cartCreateAndRedirect(lines) {
  const shop = getShopDomain();
  const token = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN || process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;
  if (!token) throw new Error("Falta NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN");

  const url = `https://${shop}/api/2024-07/graphql.json`;
  const query = `
    mutation CartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart { id checkoutUrl }
        userErrors { field message }
      }
    }
  `;

  // Normaliza atributos: Shopify espera attributes: [{key, value}]
  const normLines = (lines || []).map((ln) => {
    const base = {
      quantity: Number(ln.quantity || 1),
      merchandiseId: toGid(ln.merchandiseId || ln.variantId || ln.id),
    };
    const attrs = Array.isArray(ln.attributes) ? ln.attributes
      : Object.entries(ln.attributes || {}).map(([k, v]) => ({ key: String(k), value: String(v) }));
    if (attrs.length) base.attributes = attrs;
    return base;
  });

  const body = JSON.stringify({ query, variables: { input: { lines: normLines } } });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body,
  });
  const json = await res.json();
  const err = json?.errors?.[0]?.message || json?.data?.cartCreate?.userErrors?.[0]?.message;
  if (err) throw new Error("shopify-graphql-error: " + err);

  const checkoutUrl = json?.data?.cartCreate?.cart?.checkoutUrl;
  if (!checkoutUrl) throw new Error("checkoutUrl-missing");

  if (typeof window !== "undefined") {
    window.location.assign(checkoutUrl);
  }
  return checkoutUrl;
}
