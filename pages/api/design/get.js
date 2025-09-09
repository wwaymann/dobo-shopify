import { storefrontRequest, adminRequest } from '../../../lib/shopify';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).end();
    const { productId } = req.query;
    const customerAccessToken = req.headers.authorization?.replace('Bearer ', '') || '';

    if (!productId) return res.status(400).json({ error: 'productId requerido' });
    if (!customerAccessToken) return res.status(200).json({ value: null, source: 'local' });

    const data1 = await storefrontRequest(
      `query GetCustomer($token:String!){
        customer(customerAccessToken:$token){ id }
      }`,
      { token: customerAccessToken }
    );
    const gid = data1?.customer?.id;
    if (!gid) return res.status(200).json({ value: null, source: 'no-customer' });

    const customerId = gid.split('/').pop();
    const namespace = 'dobo';
    const key = `design_${productId}`;

    const data2 = await adminRequest(
      `query GetDesign($ownerId: ID!, $ns: String!, $key: String!) {
        metafield(ownerId: $ownerId, namespace: $ns, key: $key) { id value }
      }`,
      { ownerId: `gid://shopify/Customer/${customerId}`, ns: namespace, key }
    );

    const value = data2?.metafield?.value || null;
    return res.status(200).json({ value, source: 'customer.metafield' });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
