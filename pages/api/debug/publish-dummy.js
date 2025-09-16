// pages/api/debug/publish-dummy.js
export const runtime = 'nodejs';
export const config = { api: { bodyParser: false } };

// PNG 1x1 transparente
const DUMMY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAA' +
  'AAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

export default async function handler(req, res) {
  try {
    const variantId = req.query.variant || '';
    if (!variantId) return res.status(400).json({ ok:false, error:'missing variant' });

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const base = `${proto}://${host}`;

    const body = {
      variantId,
      previewDataURL: DUMMY_PNG,
      design: { objects:[], meta:{ source:'dummy' } },
      meta: { test:true }
    };

    const r = await fetch(`${base}/api/publish-by-variant`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(body)
    });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    if (!r.ok || !json?.ok) return res.status(r.status).json({ ok:false, from:'publish-by-variant', body: json||text });

    return res.status(200).json({ ok:true, result: json });
  } catch (e) {
    return res.status(500).json({ ok:false, error:String(e) });
  }
}
