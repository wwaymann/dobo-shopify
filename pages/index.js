// pages/index.js

import { useEffect, useState } from "react";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => {
        if (!res.ok) throw new Error("API request failed");
        return res.json();
      })
      .then((data) => setProducts(data))
      .catch((err) => {
        console.error("Error fetching products:", err);
        setError("No se pudieron cargar los productos. Intenta nuevamente.");
      });
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>DOBO Shop</h1>
      <p>Planta una idea</p>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
        {products.map((product) => {
          const imageUrl = product.images?.edges?.[0]?.node?.url;
          const imageAlt = product.images?.edges?.[0]?.node?.altText || product.title;
          const price = product.variants?.edges?.[0]?.node?.price?.amount;

          return (
            <div
              key={product.id}
              style={{
                border: "1px solid #ccc",
                padding: "1rem",
                width: "200px",
              }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={imageAlt}
                  style={{ width: "100%", height: "auto" }}
                />
              ) : (
                <p>Imagen no disponible</p>
              )}
              <h3>{product.title}</h3>
              <p>{product.description}</p>
              {price && <strong>${price}</strong>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
