// pages/index.js

import React, { useEffect, useState } from "react";

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("/api/products");
        if (!res.ok) {
          throw new Error("Error fetching products");
        }
        const data = await res.json();
        setProducts(data);
      } catch (err) {
        setError(err.message);
      }
    }

    fetchProducts();
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>DOBO Shop</h1>
      <p>Planta una idea</p>
      {error && <p>Error: {error}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
        {products.map((product) => (
          <div key={product.id} style={{ border: "1px solid #ccc", padding: "1rem", width: "200px" }}>
            {product.images?.edges[0]?.node?.url && (
              <img
                src={product.images.edges[0].node.url}
                alt={product.images.edges[0].node.altText || product.title}
                style={{ width: "100%", height: "auto" }}
              />
            )}
            <h3>{product.title}</h3>
            <p>{product.description}</p>
            <p>
              {product.variants?.edges[0]?.node?.price?.amount}
              {" "}
              {product.variants?.edges[0]?.node?.price?.currencyCode}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
