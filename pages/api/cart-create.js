// pages/api/cart-create.js
export const config = { runtime: "edge" };
const STOREFRONT_VERSION = "2024-04";
function getEnv() {
  const shop =
    process.env.SHOPIFY_SHOP ||
    process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ||
    process.env.NEXT_PUBLIC_SHOP_DOMAIN;
  const token =
    process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;
  return { shop, token };
}
const MUTATION = `#graphql
mutation CartCreate($input: CartInput!) {
  cartCreate(input: $input) {
    cart { id checkoutUrl }
    userErrors { field message }
  }
}`;
export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method-not-allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const { shop, token } = getEnv();
    if (!shop || !token) {
      return new Response(JSON.stringify({ error: "storefront-misconfigured" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }
    const { lines = [], attributes = [] } = await req.json();
    const url = `https://${shop}/api/${STOREFRONT_VERSION}/graphql.json`;
    const input = {
      lines: lines.map((ln) => ({
        merchandiseId: ln.merchandiseId,
        quantity: Number(ln.quantity || 1),
        attributes: (ln.attributes || []).map((a) => ({
          key: String(a.key || "").replace(/^_+/, ""),
          value: String(a.value ?? ""),
        })),
      })),
      attributes: (attributes || []).map((a) => ({
        key: String(a.key || "").replace(/^_+/, ""),
        value: String(a.value ?? ""),
      })),
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query: MUTATION, variables: { input } }),
    });
    const j = await res.json();
    const err = j?.data?.cartCreate?.userErrors?.[0]?.message;
    const checkoutUrl = j?.data?.cartCreate?.cart?.checkoutUrl;
    if (!res.ok || err || !checkoutUrl) {
      return new Response(
        JSON.stringify({ error: err || j?.errors?.[0]?.message || "cart-create-failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ checkoutUrl }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
