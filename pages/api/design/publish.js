// pages/api/design/publish.js

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } }, // por si mandas PNG base64
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { designJSON, previewBase64, status = 'draft', tags = [] } = req.body || {};

    if (!designJSON) return res.status(400).json({ error: 'designJSON requerido' });

    // TODO: persistir en Shopify: crea/actualiza producto o metafield con designJSON + previewBase64
    // Este stub solo retorna lo recibido para que puedas probar end-to-end.
    return res.status(200).json({
      ok: true,
      saved: {
        designJSON,
        previewBase64: !!previewBase64,
        status,
        tags,
      },
    });
  } catch (err) {
    console.error('publish error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
