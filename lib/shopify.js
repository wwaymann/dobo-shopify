// /lib/shopify.js
// Helpers para Admin y Storefront
const ADMIN_API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION || '2024-07';
const STOREFRONT_API_VERSION = process.env.SHOPIFY_STOREFRONT_API_VERSION || '2024-07';

export async function shopifyAdmin(path, { method = 'GET', body } = {}) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN; // ej: um7xus-0u.myshopify.com
  const token  = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN; // Admin API (no Storefront)
  if (!domain || !token) {
    throw new Error('Faltan SHOPIFY_STORE_DOMAIN o SHOPIFY_ADMIN_ACCESS_TOKEN en .env');
  }
  const url = `https://${domain}/admin/api/${ADMIN_API_VERSION}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Admin ${method} ${path} fallo: ${res.status} ${text}`);
  }
  return res.json();
}

export async function shopifyStorefront(query, variables = {}) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token  = process.env.SHOPIFY_STOREFRONT_TOKEN;
  if (!domain || !token) {
    throw new Error('Faltan SHOPIFY_STORE_DOMAIN o SHOPIFY_STOREFRONT_TOKEN en .env');
  }
  const url = `https://${domain}/api/${STOREFRONT_API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Storefront-Access-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(`Storefront GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}
