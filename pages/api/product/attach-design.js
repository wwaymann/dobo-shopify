import { adminGraphQL } from "../../../lib/shopifyAdmin";

async function findProductIdByHandle(handle) {
  const data = await adminGraphQL(`
    query($q:String!) {
      products(first:1, query:$q) { edges { node { id handle } } }
    }
  `, { q: `handle:${handle}` });
  const n = data?.products?.edges?.[0]?.node;
  return n?.id || null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') { res.status(405).end(); return; }
    const { productId, productHandle, designId, previewUrl, jsonUrl } = req.body || {};
    if ((!productId && !productHandle) || !jsonUrl) {
      res.status(400).json({ error: 'Faltan productId/productHandle o jsonUrl' }); return;
    }
    const ownerId = productId || await findProductIdByHandle(productHandle);
    if (!ownerId) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

    const metafields = [
      { ownerId, namespace: "dobo", key: "designId", type: "single_line_text_field", value: String(designId || "") },
      { ownerId, namespace: "dobo", key: "designJsonUrl", type: "url", value: String(jsonUrl) },
      { ownerId, namespace: "dobo", key: "designPreviewUrl", type: "url", value: String(previewUrl || "") }
    ];

    const data = await adminGraphQL(`
      mutation set($metafields:[MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id key namespace }
          userErrors { field message code }
        }
      }
    `, { metafields });

    const errs = data?.metafieldsSet?.userErrors;
    if (errs && errs.length) { res.status(422).json({ error: errs }); return; }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'error' });
  }
}
