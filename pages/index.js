// pages/index.js

import React, { useEffect, useState } from 'react';

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
    <div>
      <h1>DOBO Shop</h1>
      <p>Planta una idea</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        {products.map((product) => (
          <div
            key={product.id}
            style={{ border: '1px solid #ccc', padding: '1rem', width: '200px' }}
          >
            {product.images?.edges?.[0]?.node?.url ? (
              <img
                src={product.images.edges[0].node.url}
                alt={product.images.edges[0].node.altText || product.title}
                style={{ width: '100%', height: 'auto' }}
              />
            ) : (
              <div style={{ height: '150px', backgroundColor: '#f0f0f0' }}>
                <p>Sin imagen</p>
              </div>
            )}
            <h3>{product.title}</h3>
            <p>{product.description}</p>
            <p>
              <strong>
                {product.variants?.edges?.[0]?.node?.price?.amount || 'N/A'}{' '}
                {product.variants?.edges?.[0]?.node?.price?.currencyCode || ''}
              </strong>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
