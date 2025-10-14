// lib/checkout.js
import { getShopDomain } from "./shopDomain";

export const toGid = (id) =>
  String(id || "").includes("gid://")
    ? String(id)
    : `gid://shopify/ProductVariant/${String(id || "").replace(/\D/g, "")}`;

export async function cartCreateAndRedirect(lines) {
  const shop = getShopDomain();
  const token =
    process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;

  if (!token) {
    throw new Error(
      "Falta NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN (o NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN)"
    );
  }

  const endpoint = `https://${shop}/api/2024-07/graphql.json`;
  const query = `
    mutation CartCreate($lines:[CartLineInput!]) {
      cartCreate(input:{ lines: $lines }) {
        cart { id checkoutUrl }
        userErrors { field message }
      }
    }
  `;

  // Normaliza IDs a GID
  const normalized = (lines || []).map((l) => ({
    quantity: Math.max(1, Number(l.quantity || 1)),
    merchandiseId: toGid(l.merchandiseId || l.variantId),
    attributes: Array.isArray(l.attributes)
      ? l.attributes.map((a) => ({
          key: String(a.key || ""),
          value: String(a.value ?? ""),
        }))
      : [],
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

  const json = await res.json().catch(() => ({}));
  const gqlErr =
    json?.errors?.[0]?.message ||
    json?.data?.cartCreate?.userErrors?.[0]?.message;

  if (!res.ok || gqlErr) {
    console.error("Storefront error:", json);
    throw new Error(`shopify-graphql-error: ${gqlErr || res.status}`);
  }

  const checkoutUrl = json?.data?.cartCreate?.cart?.checkoutUrl;
  if (!checkoutUrl) throw new Error("No se obtuvo checkoutUrl");

  window.location.href = checkoutUrl;
}
