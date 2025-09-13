import { uploadDesignToShopifyFiles } from "../../../lib/uploadToShopifyFiles";
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

function dataURLtoBuffer(dataURL) {
  const [, b64] = String(dataURL).split(',');
  return Buffer.from(b64, 'base64');
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') { res.status(405).end(); return; }
    const { design, meta, previewDataURL, designId, productId, productHandle } = req.body || {};
    if (!design || !previewDataURL) { res.status(400).json({ error: 'missing design or preview' }); return; }

    const previewBuffer = dataURLtoBuffer(previewDataURL);
    const jsonString = JSON.stringify({ design, meta }, null, 0);
    const out = await uploadDesignToShopifyFiles({ previewBuffer, jsonString, designId });

    // set metafields en producto si viene
    const ownerId = productId || (productHandle ? await findProductIdByHandle(productHandle) : null);
    if (ownerId) {
      await adminGraphQL(`
        mutation set($metafields:[MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            userErrors { field message code }
          }
        }
      `, {
        metafields: [
          { ownerId, namespace: "dobo", key: "designId", type: "single_line_text_field", value: String(out.id) },
          { ownerId, namespace: "dobo", key: "designJsonUrl", type: "url", value: String(out.jsonUrl) },
          { ownerId, namespace: "dobo", key: "designPreviewUrl", type: "url", value: String(out.previewUrl) }
        ]
      });
    }

    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'error' });
  }
}
