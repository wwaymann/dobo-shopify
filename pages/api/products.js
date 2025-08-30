// pages/api/products.js
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
              products(first: 100) {
                edges {
                  node {
                    id
                    title
                    description
                    tags
                    images(first: 100) {
                      edges {
                        node {
                          id
                          url
                        }
                      }
                    }
                    variants(first: 100) {
                      edges {
                        node {
                          id
                          title
                          price { amount }
                          compareAtPrice { amount }
                          selectedOptions { name value }
                          image { 
                            id
                            url
                          }
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

    // Defensa por si la respuesta viene con errores
    if (!json?.data?.products?.edges) {
      console.error("Shopify response error:", json?.errors || json);
      return res.status(500).json({ error: "Error al obtener productos" });
    }

    const products = json.data.products.edges.map(({ node }) => {
      const productImages = (node.images?.edges || []).map(e => ({
        id: e.node.id,
        url: e.node.url
      }));

      // 1) Primero obtenemos variantes “raw”
const rawVariants = (node.variants?.edges || []).map(({ node: v }) => ({
  id: v.id,
  title: v.title,
  price: v.price?.amount ?? null,
  compareAtPrice: v.compareAtPrice?.amount ?? null,
  selectedOptions: v.selectedOptions || [],
  image: v.image?.url ?? null,
  imageId: v.image?.id ?? null,
}));

// 2) Contamos cuántas variantes usan cada imageId
const imgCount = rawVariants.reduce((acc, v) => {
  if (v.imageId) acc[v.imageId] = (acc[v.imageId] || 0) + 1;
  return acc;
}, {});

// 3) Consideramos “imagen propia” solo si el imageId es único entre variantes
const variants = rawVariants.map(v => {
  const hasOwnImage = !!v.imageId && imgCount[v.imageId] === 1;
  return {
    ...v,
    hasOwnImage,
    // si NO es propia, anulamos la imagen para el frontend
    image: hasOwnImage ? v.image : null,
  };
});


      return {
        id: node.id,
        title: node.title,
        description: node.description,
        tags: node.tags || [],
        // Featured image del producto (no confundir con la de variante)
        image: productImages[0]?.url || "",
        images: productImages,
        // Precio base (por si quieres mostrar algo cuando no hay variante)
        price: variants[0]?.price ?? "0",
        compareAtPrice: variants[0]?.compareAtPrice ?? null,
        variants,
      };
    });

    res.status(200).json(products);
  } catch (error) {
    console.error("Error en /api/products:", error);
    res.status(500).json({ error: "Error al obtener productos" });
  }
}
