// lib/shopifyAdmin.js
export async function adminGraphQL(query, variables) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_API_TOKEN;
  if (!domain || !token) throw new Error("Faltan SHOPIFY_STORE_DOMAIN o SHOPIFY_ADMIN_API_TOKEN");

  const r = await fetch(`https://${domain}/admin/api/2024-07/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  if (!r.ok) throw new Error(`AdminGraphQL ${r.status}`);
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

export async function findProductIdByHandle(handle) {
  const data = await adminGraphQL(`
    query($q:String!) {
      products(first:1, query:$q) { edges { node { id handle } } }
    }
  `, { q: `handle:${handle}` });
  return data?.products?.edges?.[0]?.node?.id || null;
}
