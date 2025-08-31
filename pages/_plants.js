export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://um7xus-0u.myshopify.com/api/2023-01/graphql.json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN,
        },
        body: JSON.stringify({
          query: `
            {
              products(first: 100, query: "tag:plantas") {
                edges {
                  node {
                    id
                    title
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
          `,
        }),
      }
    );

    const json = await response.json();

    const products = json.data.products.edges.map(({ node }) => ({
      id: node.id,
      title: node.title,
      image: node.images.edges[0]?.node.url || "",
    }));

    res.status(200).json(products);
  } catch (error) {
    console.error("Error en /api/plants:", error);
    res.status(500).json({ error: "Error al obtener productos de plantas" });
  }
}
