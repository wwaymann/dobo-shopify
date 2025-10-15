// lib/checkout.js
// Crea carrito en Shopify (Storefront) y redirige al checkout
import { getShopDomain } from "./shopDomain";

export const toGid = (id) =>
  String(id || "").includes("gid://")
    ? String(id)
    : `gid://shopify/ProductVariant/${String(id || "").replace(/\D/g, "")}`;

/**
 * lines: [{ merchandiseId, quantity, attributes?:[{key,value}] }]
 */
export async function cartCreateAndRedirect(lines) {
  if (!Array.isArray(lines) || !lines.length) throw new Error("lines-empty");

  const res = await fetch("/api/cart-create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines, shop: getShopDomain() }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.checkoutUrl) {
    throw new Error(json?.error || "shopify-graphql-error");
  }

  // Redirigir a toplevel (por si estamos embebidos)
  if (typeof window !== "undefined") {
    window.top.location.href = json.checkoutUrl;
  }
  return json.checkoutUrl;
}