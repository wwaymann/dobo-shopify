// pages/api/products.js
export default async function handler(req, res) {
  const STORE_DOMAIN =
    process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
  const TOKEN =
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;

  const diag = String(req.query.diag || '') === '1'; // /api/products?diag=1
  let info = { ok: false, envs: { store: !!STORE_DOMAIN, token: !!TOKEN, api: API_VERSION }, shopifyStatus: null, count: 0 };

  try {
    if (!STORE_DOMAIN || !TOKEN) {
      if (diag) return res.status(200).json({ ...info, reason: 'missing_envs' });
      return res.status(200).json([]);
    }

    const r = await fetch(`https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': TOKEN,
      },
      body: JSON.stringify({
        query: `
          {
            products(first: 200) {
              edges {
                node {
                  id
                  title
                  handle
                  tags
                  priceRange { minVariantPrice { amount currencyCode } }
                  images(first: 4) { edges { node { url } } }
                  variants(first: 25) {
                    edges {
                      node {
                        id
                        title
                        availableForSale
                        image { url }
                        price { amount currencyCode }
                        selectedOptions { name value }
                      }
                    }
                  }
                }
              }
            }
          }
        `,
      }),
    });

    info.shopifyStatus = r.status;
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 400);
      if (diag) return res.status(200).json({ ...info, reason: 'shopify_error', detail });
      return res.status(200).json([]);
    }

    const json = await r.json();
    const edges = json?.data?.products?.edges || [];

    const items = edges.map(({ node }) => ({
      id: node.id,
      title: node.title,
      handle: node.handle,
      tags: Array.isArray(node.tags) ? node.tags : [],
      image: node.images?.edges?.[0]?.node?.url || '',
      images: (node.images?.edges || []).map(e => e?.node?.url).filter(Boolean),
      minPrice: {
        amount: Number(node.priceRange?.minVariantPrice?.amount || 0),
        currencyCode: node.priceRange?.minVariantPrice?.currencyCode || 'CLP',
      },
      variants: (node.variants?.edges || []).map(e => {
        const v = e?.node || {};
        return {
          id: v.id,
          title: v.title,
          availableForSale: !!v.availableForSale,
          image: v.image?.url || '',
          price: {
            amount: Number(v.price?.amount || 0),
            currencyCode: v.price?.currencyCode || 'CLP',
          },
          // ⬇️ clave correcta que espera tu UI
          selectedOptions: (v.selectedOptions || []).map(o => ({ name: o.name, value: o.value })),
        };
      }),
    }));

    info.ok = true; info.count = items.length; info.sample = items[0] || null;
    if (diag) return res.status(200).json(info);
    return res.status(200).json(items);
  } catch (e) {
    if (diag) return res.status(200).json({ ...info, reason: 'exception', detail: String(e).slice(0, 300) });
    return res.status(200).json([]);
  }
}
