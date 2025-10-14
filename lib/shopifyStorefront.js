// lib/shopifyStorefront.js
import { getShopDomain } from "./shopDomain";

function toGid(id) {
  const s = String(id || "");
  return s.includes("gid://") ? s : `gid://shopify/ProductVariant/${s.replace(/\D/g, "")}`;
}

export async function cartCreateAndRedirect(lines) {
  const shop = getShopDomain();
  const token =
    process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;

  if (!token) throw new Error("Falta NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN");

  const endpoint = `https://${shop}/api/2024-07/graphql.json`;
  const query = `
    mutation CartCreate($lines:[CartLineInput!]) {
      cartCreate(input:{ lines: $lines }) {
        cart { id checkoutUrl }
        userErrors { field message }
      }
    }
  `;

  // Normaliza variantes a GID
  const normalized = lines.map((l) => ({
    ...l,
    merchandiseId: toGid(l.merchandiseId || l.variantId),
  }));

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables: { lines: normalized } }),
  });

  const json = await res.json();
  const err = json?.errors?.[0]?.message || json?.data?.cartCreate?.userErrors?.[0]?.message;

  if (!res.ok || err) {
    console.error("Storefront error:", json);
    throw new Error(`shopify-graphql-error: ${err || res.status}`);
  }

  const url = json?.data?.cartCreate?.cart?.checkoutUrl;
  if (!url) throw new Error("No se obtuvo checkoutUrl");

  // Redirige
  window.location.href = url;
}
