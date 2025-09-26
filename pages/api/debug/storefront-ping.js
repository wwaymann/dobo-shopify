export default async function handler(req, res) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  const ver = process.env.SHOPIFY_STOREFRONT_API_VERSION || '2024-10';
  if (!domain || !token) {
    res.status(200).json({ ok:false, domainSet:!!domain, tokenSet:!!token });
    return;
  }
  const r = await fetch(`https://${domain}/api/${ver}/graphql.json`,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'X-Shopify-Storefront-Access-Token': token
    },
    body: JSON.stringify({ query:`{ shop { name primaryDomain { url } } }` })
  });
  const j = await r.json();
  res.status(r.ok?200:500).json({ ok:r.ok, response:j });
}
