import { storefrontRequest, adminRequest } from '../../../lib/shopify';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).end();
    const { productId } = req.query;
    const customerAccessToken = req.headers.authorization?.replace('Bearer ', '') || '';

    if (!productId) return res.status(400).json({ error: 'productId requerido' });

    // Si no hay token, no hay recuperación remota
    if (!customerAccessToken) return res.status(200).json({ value: null, source: 'local' });

    // 1) Resolver customer.id con Storefront
    const data1 = await storefrontRequest(
      `query GetCustomer($token:String!){
        customer(customerAccessToken:$token){ id email }
      }`,
      { token: customerAccessToken }
    );
    const customerIdStorefront = data1?.customer?.id;
    if (!customerIdStorefront) return res.status(200).json({ value: null, source: 'no-customer' });

    // Convertir gid:... a ID numérico para Admin
    const customerId = customerIdStorefront.split('/').pop();

    const namespace = 'dobo';
    const key = `design_${productId}`;

    // 2) Leer metafield con Admin API
    const data2 = await adminRequest(
      `query GetDesign($ownerId: ID!, $ns: String!, $key: String!) {
        metafield(ownerId: $ownerId, namespace: $ns, key: $key) { id namespace key type value }
      }`,
      { ownerId: `gid://shopify/Customer/${customerId}`, ns: namespace, key }
    );

    const value = data2?.metafield?.value || null;
    return res.status(200).json({ value, source: 'customer.metafield' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
