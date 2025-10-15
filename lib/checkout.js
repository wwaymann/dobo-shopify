// lib/checkout.js
export const toGid = (id) => {
  const s = String(id || "");
  return s.includes("gid://")
    ? s
    : `gid://shopify/ProductVariant/${s.replace(/\D/g, "")}`;
};
export async function cartCreateAndRedirect(lines, attributes = []) {
  const res = await fetch("/api/cart-create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines, attributes }),
  });
  let j = null;
  try { j = await res.json(); } catch (e) {}
  if (!res.ok || !j?.checkoutUrl) {
    throw new Error(j?.error || "cart-create-failed");
  }
  window.location.assign(j.checkoutUrl);
}
