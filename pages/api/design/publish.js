// pages/api/design/publish.js
import { uploadDesignToShopifyFiles } from '../../../lib/uploadToShopifyFiles';
import { adminGraphQL, findProductIdByHandle } from '../../../lib/shopifyAdmin';

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

    // Adjunta automáticamente a metacampos del producto si se indica
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
          { ownerId, namespace: "dobo", key: "design_json_url",     type: "url",                    value: String(out.jsonUrl) },
          { ownerId, namespace: "dobo", key: "design_preview_url",  type: "url",                    value: String(out.previewUrl) },
          { ownerId, namespace: "dobo", key: "design_id",           type: "single_line_text_field", value: String(out.id) }
        ]
      });
    }

    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'error' });
  }
}
