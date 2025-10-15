// pages/api/design-product.js
const ADMIN_VER = '2024-07';

async function adminGQL(shop, token, query, variables = {}) {
  const r = await fetch(`https://${shop}/admin/api/${ADMIN_VER}/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST' });
  try {
    const shop  = process.env.SHOPIFY_SHOP;
    const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    const {
      previewUrl, price, designId,
      color = 'Único', size = 'Único',
      plantTitle = 'Planta', potTitle = 'Maceta', title
    } = req.body || {};

    if (!shop || !token) return res.status(500).json({ error: 'Missing env' });
    if (!previewUrl || price == null || !designId) return res.status(400).json({ error: 'Missing fields' });

    const doboTitle = title || `DOBO ${plantTitle} + ${potTitle} (${color} / ${size})`;
    const bullets =
      `• Planta: ${plantTitle}\n` +
      `• Maceta: ${potTitle}\n` +
      `• Color: ${color}\n` +
      `• Tamaño: ${size}\n` +
      `• Diseño DOBO #${designId}`;

    // 1) crear
    const createRes = await fetch(`https://${shop}/admin/api/${ADMIN_VER}/products.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: {
          title: doboTitle,
          body_html: `<p>${bullets.replace(/\n/g,'<br>')}</p>`,
          status: 'active',
          tags: 'custom-generated,dobo',
          images: [{ src: previewUrl, alt: `DOBO ${designId}` }],
          options: [{ name: 'Color' }, { name: 'Tamaño' }],
          variants: [{ option1: color, option2: size, price: String(price), sku: designId, inventory_management: null }],
          published_scope: 'web'
        }
      })
    });
    const created = await createRes.json();
    if (!createRes.ok) return res.status(createRes.status).json({ error: created?.errors || created });

    const productId = created.product?.id;
    const variantId = created.product?.variants?.[0]?.id;

    // 2) publicar a Online Store (por si tu tema lo requiere)
    let pubId = process.env.SHOPIFY_PUBLICATION_ID || '';
    if (!pubId) {
      const pubs = await adminGQL(shop, token, `query{ publications(first:50){ nodes{ id name } } }`);
      pubId = pubs?.data?.publications?.nodes?.find(p => /online store/i.test(p.name))?.id || '';
    }
    if (pubId) {
      const r = await adminGQL(shop, token,
        `mutation($id:ID!,$p:[ID!]!){ publishablePublish(id:$id, publicationIds:$p){ userErrors{ message } }}`,
        { id:`gid://shopify/Product/${productId}`, p:[pubId] }
      );
      if (r?.data?.publishablePublish?.userErrors?.length) {
        return res.status(500).json({ error: r.data.publishablePublish.userErrors });
      }
    }

    return res.status(200).json({ productId, variantId });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}
