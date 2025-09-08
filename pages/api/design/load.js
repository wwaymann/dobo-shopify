// pages/api/design/load.js

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { handle } = req.query || {};
    if (!handle) return res.status(400).json({ error: 'handle requerido' });

    // TODO: leer desde Shopify por `handle` el JSON previamente guardado.
    // Mientras tanto, responde 404 para indicar que falta la implementación real.
    return res.status(404).json({ error: 'no_implementado', handle });
  } catch (err) {
    console.error('load error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
