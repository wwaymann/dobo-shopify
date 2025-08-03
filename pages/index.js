// Este es el archivo index.js que debe corregirse
declare const React: any;

import Head from 'next/head';
import { useEffect, useState } from 'react';

export default function Home() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch('/api/products');
        const data = await res.json();
        setProducts(data);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    }

    fetchProducts();
  }, []);

  return (
    <>
      <Head>
        <title>DOBO Shop</title>
      </Head>
      <main>
        <h1>DOBO Shop</h1>
        <p>Planta una idea</p>
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {products.map((product) => (
            <div key={product.id} style={{ border: '1px solid #ccc', margin: 10, padding: 10, width: 200 }}>
              {product.images?.edges[0]?.node?.url && (
                <img src={product.images.edges[0].node.url} alt={product.images.edges[0].node.altText || product.title} width="200" />
              )}
              <h3>{product.title}</h3>
              <p>{product.description}</p>
              <p>
                {product.variants?.edges[0]?.node?.price?.amount && (
                  <>
                    ${product.variants.edges[0].node.price.amount}
                  </>
                )}
              </p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
