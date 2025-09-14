export default function handler(req, res) {
  const d = !!process.env.SHOPIFY_STORE_DOMAIN;
  const t = !!process.env.SHOPIFY_STOREFRONT_API_TOKEN;
  res.status(200).json({ domainSet: d, tokenSet: t });
}
