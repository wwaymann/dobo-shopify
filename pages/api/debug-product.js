const ADMIN_VER = '2024-07';
const SF_VER = '2024-07';

export default async function handler(req, res) {
  try {
    const shop = process.env.SHOPIFY_SHOP;
    const at   = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const sft  = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
    const PUB  = process.env.SHOPIFY_PUBLICATION_ID; // gid://shopify/Publication/...

    const { productId, variantId } = req.query; // numéricos (los que te devolvió create)
    if (!productId || !variantId) return res.status(400).json({ error: 'pass productId & variantId (numbers)' });

    const pGID = `gid://shopify/Product/${productId}`;
    const vGID = `gid://shopify/ProductVariant/${variantId}`;

    // 1) Admin: a qué canales está publicado este producto
    const pubs = await fetch(`https://${shop}/admin/api/${ADMIN_VER}/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': at, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($id:ID!){ resourcePublications(first:50,publishedResourceId:$id){
          nodes{ publication{ id name } } } }`,
        variables: { id: pGID }
      })
    }).then(r => r.json()); 

    // 2) Storefront: ¿lo ve este token?
    const sf = await fetch(`https://${shop}/api/${SF_VER}/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Storefront-Access-Token': sft, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `query($id:ID!){ node(id:$id){ id } }`, variables: { id: vGID } })
    }).then(r => r.json()).catch(()=>null);

    return res.status(200).json({
      publicationEnv: PUB,
      resourcePublications: pubs?.data?.resourcePublications?.nodes || [],
      storefrontSeesVariant: sf?.data?.node?.id === vGID,
      storefrontNode: sf?.data?.node || null
    });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}
