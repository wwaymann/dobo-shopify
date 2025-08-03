import client from '../../lib/shopify';

export default async function handler(req, res) {
  try {
    const query = `
      {
        products(first: 10) {
          edges {
            node {
              id
              title
              description
              images(first: 1) {
                edges {
                  node {
                    url
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await client.post('', { query });
    const products = response.data.data.products.edges;
    res.status(200).json(products);
  } catch (error) {
    console.error('Error en Shopify API:', error.message);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
}
