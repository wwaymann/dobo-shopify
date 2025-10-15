// pages/api/cart.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const { intent = "add", cartId, lines = [] } = req.body || {};

  // Endpoint: usa directamente SHOPIFY_STOREFRONT_ENDPOINT o lo arma con SHOPIFY_STORE_DOMAIN
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-07";
  const endpoint =
    process.env.SHOPIFY_STOREFRONT_ENDPOINT ||
    (process.env.SHOPIFY_STORE_DOMAIN
      ? `https://${process.env.SHOPIFY_STORE_DOMAIN}/api/${apiVersion}/graphql.json`
      : null);

  // Token: admite token privado o público
  const privateToken = process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN || null;
  const publicToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || null;

  const token = privateToken || publicToken;
  const headerName = privateToken
    ? "Shopify-Storefront-Private-Token"
    : "X-Shopify-Storefront-Access-Token";

  if (!endpoint || !token) {
    return res.status(500).json({ error: "Shopify Storefront API env vars missing" });
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: "lines required" });
  }

  const fetchGQL = async (query, variables) => {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [headerName]: token,
      },
      body: JSON.stringify({ query, variables }),
    });
    const json = await r.json();
    return json;
  };

  const CART_CREATE = /* GraphQL */ `
    mutation CartCreate($lines: [CartLineInput!]) {
      cartCreate(input: { lines: $lines }) {
        cart { id checkoutUrl }
        userErrors { field message }
      }
    }
  `;
  const CART_LINES_ADD = /* GraphQL */ `
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart { id checkoutUrl }
        userErrors { field message }
      }
    }
  `;

  try {
    if (intent === "buy") {
      const resp = await fetchGQL(CART_CREATE, { lines });
      const err = resp?.data?.cartCreate?.userErrors?.[0]?.message;
      if (err) return res.status(400).json({ error: err });
      const cart = resp?.data?.cartCreate?.cart;
      return res.status(200).json({ cartId: cart?.id, checkoutUrl: cart?.checkoutUrl, cart });
    }

    if (!cartId) {
      const resp = await fetchGQL(CART_CREATE, { lines });
      const err = resp?.data?.cartCreate?.userErrors?.[0]?.message;
      if (err) return res.status(400).json({ error: err });
      const cart = resp?.data?.cartCreate?.cart;
      return res.status(200).json({ cartId: cart?.id, checkoutUrl: cart?.checkoutUrl, cart });
    } else {
      const resp = await fetchGQL(CART_LINES_ADD, { cartId, lines });
      const err = resp?.data?.cartLinesAdd?.userErrors?.[0]?.message;
      if (err) return res.status(400).json({ error: err });
      const cart = resp?.data?.cartLinesAdd?.cart;
      return res.status(200).json({ cartId: cart?.id, checkoutUrl: cart?.checkoutUrl, cart });
    }
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
