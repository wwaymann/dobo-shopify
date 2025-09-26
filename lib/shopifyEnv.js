// lib/shopifyEnv.js
export const SHOP_DOMAIN =
  process.env.SHOPIFY_STORE_DOMAIN ||
  process.env.SHOPIFY_SHOP ||
  process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ||
  process.env.NEXT_PUBLIC_SHOPFTY_STORE_DOMAIN || // typo en tu captura
  process.env.SHOPFTY_SHOP;                        // typo

export const STOREFRONT_TOKEN =
  process.env.SHOPIFY_STOREFRONT_TOKEN ||
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||   // tienes este
  process.env.SHOPIFY_STOREFRONT_API_TOKEN ||      // y este
  process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN ||
  process.env.NEXT_PUBLIC_SHOPFTY_STOREFRONT_ACCESS__ || // typo en tu captura
  process.env.NEXT_PUBLIC_SHOPFTY_STOREFRONT_TOKEN;
