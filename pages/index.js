import { useEffect, useState } from 'react';

export default function Home() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error('Error al obtener productos:', err));
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Productos DOBO</h1>
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {products.map((product) => (
          <div key={product.node.id} style={{ width: '200px' }}>
            <img
              src={product.node.images.edges[0]?.node.url}
              alt={product.node.title}
              style={{ width: '100%', borderRadius: '8px' }}
            />
            <h3>{product.node.title}</h3>
            <p>{product.node.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
