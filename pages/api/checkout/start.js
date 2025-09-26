import { SHOP_DOMAIN, STOREFRONT_TOKEN } from '../../lib/shopifyEnv';

export default async function handler(req, res) {
  if (!SHOP_DOMAIN || !STOREFRONT_TOKEN)
    return res.status(500).json({ ok:false, error:'missing-env' });

  const q = `mutation CartCreate($lines:[CartLineInput!]!, $buyerIdentity:CartBuyerIdentityInput){
    cartCreate(input:{lines:$lines, buyerIdentity:$buyerIdentity}) {
      cart { id checkoutUrl } userErrors { field message }
    }}`;
  const r = await fetch(`https://${SHOP_DOMAIN}/api/2024-07/graphql.json`, {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query:q, variables:req.body || {} })
  });
  const j = await r.json();
  const errs = j?.errors || j?.data?.cartCreate?.userErrors;
  if (errs?.length) return res.status(400).json({ ok:false, error:'shopify-graphql-error', details:errs });
  return res.status(200).json({ ok:true, checkoutUrl:j?.data?.cartCreate?.cart?.checkoutUrl });
}
