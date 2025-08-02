import React, { useEffect, useState } from 'react';

export default function Home() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data));
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>DOBO Shop</h1>
      <p>Planta una idea</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {products.map(product => (
          <div key={product.id} style={{ textAlign: 'center' }}>
            <img
              src={product.images.edges[0]?.node.url}
              alt={product.title}
              width="150"
              style={{ borderRadius: 10 }}
            />
            <div>{product.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}