export default async function handler(req, res) {
  try {
    const handle = String(req.query.handle || "");
    if (!handle) return res.status(400).json({ error: "handle requerido" });

    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const token  = process.env.SHOPIFY_STOREFRONT_API_TOKEN;
    const query = `
      query ProductByHandle($handle: String!) {
        product(handle: $handle) {
          id
          handle
          designJsonUrl: metafield(namespace:"dobo", key:"design_json_url"){ value }
          designPreviewUrl: metafield(namespace:"dobo", key:"design_preview_url"){ value }
          designId: metafield(namespace:"dobo", key:"design_id"){ value }
        }
      }
    `;
    const r = await fetch(`https://${domain}/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token
      },
      body: JSON.stringify({ query, variables: { handle } })
    });
    const j = await r.json();
    res.status(200).json(j?.data?.product || null);
  } catch (e) {
    res.status(500).json({ error: e?.message || "error" });
  }
}
