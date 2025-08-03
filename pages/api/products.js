// components/ProductList.js

import React, { useEffect, useState } from 'react';

const ProductList = () => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products');
        const data = await res.json();
        setProducts(data);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };
    fetchProducts();
  }, []);

  return (
    <div>
      <h1>DOBO Shop</h1>
      <p>Planta una idea</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {products.map((product) => (
          <div key={product.id} style={{ border: '1px solid #ccc', padding: '10px', width: '200px' }}>
            {product.images?.edges?.[0]?.node?.url ? (
              <img
                src={product.images.edges[0].node.url}
                alt={product.images.edges[0].node.altText || product.title}
                style={{ width: '100%', height: 'auto' }}
              />
            ) : (
              <div style={{ height: '150px', backgroundColor: '#eee' }}>Sin imagen</div>
            )}
            <h3>{product.title}</h3>
            <p>{product.description}</p>
            <p>
              $
              {product.variants.edges[0].node.price.amount}
              {' '}
              {product.variants.edges[0].node.price.currencyCode}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductList;
