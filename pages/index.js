import { useEffect, useState } from 'react';
import { getProducts } from '../lib/shopify';

export default function Home() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    getProducts().then(setProducts);
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h1>DOBO Shop – Productos</h1>
      {products.length === 0 && <p>Cargando productos...</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        {products.map((product, index) => (
          <div key={index} style={{ border: '1px solid #ccc', padding: '1rem', width: '250px' }}>
            <img src={product.images[0]?.edges[0]?.node?.src} alt={product.title} style={{ width: '100%' }} />
            <h2>{product.title}</h2>
            <p>{product.description}</p>
            <p><strong>${product.variants[0]?.edges[0]?.node?.price?.amount}</strong></p>
          </div>
        ))}
      </div>
    </div>
  );
}
