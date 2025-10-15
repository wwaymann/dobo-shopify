// lib/admin.js
export async function adminGraphQL(query, variables = {}) {
  const shop = process.env.SHOPIFY_SHOP || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!shop || !token) {
    throw new Error("admin-misconfigured");
  }
  const url = `https://${shop}/admin/api/2024-04/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const j = await res.json();
  if (!res.ok || j?.errors) {
    throw new Error(
      j?.errors?.map?.((e) => e.message).join("; ") ||
        `admin-graphql-http-${res.status}`
    );
  }
  return j.data;
}
