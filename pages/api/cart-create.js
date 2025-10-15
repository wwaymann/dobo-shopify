// pages/api/cart-create.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method-not-allowed" });

  try {
    const { lines } = req.body || {};
    const domain =
      process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ||
      process.env.NEXT_PUBLIC_SHOP_DOMAIN ||
      process.env.SHOPIFY_SHOP;
    const token =
      process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;

    if (!domain) return res.status(400).json({ error: "missing-domain" });
    if (!token) return res.status(400).json({ error: "missing-storefront-token" });

    const endpoint = `https://${domain}/api/2024-07/graphql.json`;
    const query = `#graphql
      mutation cartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart { id checkoutUrl }
          userErrors { field message }
        }
      }
    `;

    const sf = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query, variables: { input: { lines } } }),
    });

    const json = await sf.json();
    const err = json?.errors?.[0]?.message || json?.data?.cartCreate?.userErrors?.[0]?.message;
    const checkoutUrl = json?.data?.cartCreate?.cart?.checkoutUrl;

    if (err || !checkoutUrl) {
      return res.status(500).json({ error: "shopify-graphql-error", raw: json });
    }

    res.status(200).json({ checkoutUrl });
  } catch (e) {
    console.error("cart-create error", e);
    res.status(500).json({ error: "internal-error" });
  }
}