import { storefrontRequest, adminRequest } from '../../../lib/shopify';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();
    const customerAccessToken = req.headers.authorization?.replace('Bearer ', '') || '';
    const { productId, jsonValue } = req.body || {};

    if (!productId || !jsonValue) return res.status(400).json({ error: 'productId y jsonValue requeridos' });
    if (!customerAccessToken) return res.status(200).json({ saved: false, reason: 'no-token' });

    const data1 = await storefrontRequest(
      `query GetCustomer($token:String!){
        customer(customerAccessToken:$token){ id }
      }`,
      { token: customerAccessToken }
    );
    const gid = data1?.customer?.id;
    if (!gid) return res.status(200).json({ saved: false, reason: 'no-customer' });

    const customerId = gid.split('/').pop();
    const namespace = 'dobo';
    const key = `design_${productId}`;

    const data2 = await adminRequest(
      `mutation Upsert($input: MetafieldsSetInput!) {
        metafieldsSet(metafields: [$input]) {
          metafields { id }
          userErrors { field message }
        }
      }`,
      {
        input: {
          ownerId: `gid://shopify/Customer/${customerId}`,
          namespace,
          key,
          type: 'json',
          value: typeof jsonValue === 'string' ? jsonValue : JSON.stringify(jsonValue),
        },
      }
    );

    const errs = data2?.metafieldsSet?.userErrors;
    if (errs && errs.length) return res.status(400).json({ saved: false, errors: errs });

    return res.status(200).json({ saved: true });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
