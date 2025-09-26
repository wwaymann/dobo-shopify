export const SHOP_DOMAIN =
  process.env.SHOPIFY_STORE_DOMAIN ||
  process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ||
  process.env.SHOPIFY_SHOP ||
  process.env.NEXT_PUBLIC_SHOPFTY_STORE_DOMAIN; // typo tolerado

export const STOREFRONT_TOKEN =
  process.env.SHOPIFY_STOREFRONT_TOKEN ||
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN ||
  process.env.NEXT_PUBLIC_SHOPFTY_STOREFRONT_ACCESS__ || // typo tolerado
  process.env.SHOPIFY_STOREFRONT_API_TOKEN ||            // “API”, no “APT”
  process.env.SHOPIFY_STOREFRONT_APT_TOKEN;              // typo tolerado
