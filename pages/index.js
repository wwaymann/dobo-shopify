import { useEffect, useState } from 'react';
import { getProducts } from '../lib/shopify';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch((err) => {
        console.error('Error cargando productos:', err);
        setError('Hubo un problema al cargar los productos');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h1>🪴 DOBO Shop – Productos</h1>

      {loading && <p>Cargando productos...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        {products.map((product, index) => {
          const image = product.images?.edges[0]?.node?.src;
          const price = product.variants?.edges[0]?.node?.price?.amount;

          return (
            <div key={index} style={{
              border: '1px solid #ccc',
              borderRadius: '8px',
              padding: '1rem',
              width: '250px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              {image && <img src={image} alt={product.title} style={{ width: '100%' }} />}
              <h2>{product.title}</h2>
              <p>{product.description}</p>
              {price && <p><strong>${price}</strong></p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

