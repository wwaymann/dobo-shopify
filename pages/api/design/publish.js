// /pages/api/design/publish.js
import { shopifyAdmin } from '../../../lib/shopify';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  try {
    const {
      title,                // string (opcional) - por defecto "Diseño DOBO <fecha>"
      designJSON,           // objeto serializable con TODO tu estado de diseño
      previewBase64,        // string base64 (SIN prefijo data:) de la imagen preview
      status = 'draft',     // 'active' | 'draft'
      tags = [],            // array de strings
      productType = 'DOBO Personalizado',
      vendor = 'Taller DOBO',
      publishToOnlineStore = false, // si true y status active -> publica
    } = req.body || {};

    if (!designJSON || !previewBase64) {
      return res.status(400).json({ ok: false, error: 'Faltan designJSON o previewBase64' });
    }

    const dateStr = new Date().toISOString().slice(0, 19).replace('T',' ');
    const productTitle = title && String(title).trim().length
      ? title.trim()
      : `Diseño DOBO ${dateStr}`;

    // 1) Crear producto con imagen (attachment base64) y metafield del diseño
    const createPayload = {
      product: {
        title: productTitle,
        vendor,
        product_type: productType,
        status, // draft o active
        tags: Array.isArray(tags) ? tags.join(', ') : undefined,
        images: [
          { attachment: previewBase64 } // preview
        ],
        metafields: [
          {
            namespace: 'dobo',
            key: 'design_json',
            type: 'json',
            value: JSON.stringify(designJSON),
          }
        ]
      }
    };

    const created = await shopifyAdmin('/products.json', { method: 'POST', body: createPayload });
    const product = created?.product;
    if (!product?.id) {
      throw new Error(`No se obtuvo product.id en creación: ${JSON.stringify(created)}`);
    }

    // 2) (Opcional) Publicar en Online Store si corresponde
    if (publishToOnlineStore && status === 'active') {
      // Publicaciones (Publications API). Por simplicidad, muchos shops ya exponen Online Store por defecto.
      // Si tu tema requiere publication explícita, podrías crearla aquí.
      // Este paso se omite en la mayoría de tiendas modernas.
    }

    // 3) Responder con datos útiles
    const result = {
      ok: true,
      productId: product.id,
      handle: product.handle,
      status: product.status,
      adminUrl: `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/products/${product.id}`,
      onlineUrl: product.handle
        ? `https://${process.env.SHOPIFY_STORE_DOMAIN}/products/${product.handle}`
        : null,
    };
    return res.status(200).json(result);
  } catch (err) {
    console.error('publish error', err);
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
