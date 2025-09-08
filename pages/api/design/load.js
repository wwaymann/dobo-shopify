// /pages/api/design/load.js
import { shopifyStorefront } from '../../../lib/shopify';

const QUERY_BY_HANDLE = `
  query($handle: String!) {
    product(handle: $handle) {
      id
      title
      handle
      featuredImage { url }
      metafield(namespace: "dobo", key: "design_json") {
        value
        type
      }
    }
  }
`;

const QUERY_BY_ID = `
  query($id: ID!) {
    node(id: $id) {
      ... on Product {
        id
        title
        handle
        featuredImage { url }
        metafield(namespace: "dobo", key: "design_json") {
          value
          type
        }
      }
    }
  }
`;

export default async function handler(req, res) {
  try {
    const { handle, gid } = req.query || {};
    if (!handle && !gid) {
      return res.status(400).json({ ok: false, error: 'Debes pasar ?handle=... o ?gid=gid://shopify/Product/...' });
    }
    let data;
    if (handle) {
      data = await shopifyStorefront(QUERY_BY_HANDLE, { handle });
      const p = data?.product;
      if (!p) return res.status(404).json({ ok: false, error: 'Producto no encontrado' });
      const json = p.metafield?.value ? JSON.parse(p.metafield.value) : null;
      return res.status(200).json({
        ok: true,
        source: 'handle',
        product: {
          id: p.id, title: p.title, handle: p.handle, image: p.featuredImage?.url || null
        },
        designJSON: json
      });
    } else {
      data = await shopifyStorefront(QUERY_BY_ID, { id: gid });
      const n = data?.node;
      if (!n) return res.status(404).json({ ok: false, error: 'Producto no encontrado' });
      const json = n.metafield?.value ? JSON.parse(n.metafield.value) : null;
      return res.status(200).json({
        ok: true,
        source: 'gid',
        product: {
          id: n.id, title: n.title, handle: n.handle, image: n.featuredImage?.url || null
        },
        designJSON: json
      });
    }
  } catch (err) {
    console.error('load error', err);
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
