// Análisis inicial basado en la arquitectura y el .env

// Supuestos y confirmaciones:
// - Estás usando la Storefront API de Shopify (NO la Admin API).
// - El dominio en tu .env contiene https://, lo cual es innecesario para esta API.
// - El JSON resultante desde Shopify NO está entregando bien las URLs de las imágenes o están en campos que no se están utilizando correctamente en el frontend.
// - El error 500 puede estar vinculado al parseo incorrecto del JSON o estructura inesperada del response.

// Corrección y simplificación en la API `pages/api/products.js`:

export default async function handler(req, res) {
  const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const token = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

  if (!domain || !token) {
    return res.status(500).json({ error: "Faltan variables de entorno" });
  }

  const endpoint = `https://${domain}/api/2023-04/graphql.json`;
  const query = `
    query {
      products(first: 20) {
        edges {
          node {
            id
            title
            handle
            description
            images(first: 1) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            variants(first: 1) {
              edges {
                node {
                  price {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query }),
    });

    const json = await response.json();

    if (!json || !json.data || !json.data.products) {
      return res.status(500).json({ error: "Respuesta de Shopify inválida", details: json });
    }

    const products = json.data.products.edges.map(({ node }) => ({
      id: node.id,
      title: node.title,
      handle: node.handle,
      description: node.description,
      image: node.images.edges[0]?.node?.url || '',
      altText: node.images.edges[0]?.node?.altText || '',
      price: node.variants.edges[0]?.node?.price?.amount || '0',
      currency: node.variants.edges[0]?.node?.price?.currencyCode || 'USD',
    }));

    return res.status(200).json(products);
  } catch (error) {
    return res.status(500).json({ error: "Shopify fetch error", details: error.message });
  }
}
