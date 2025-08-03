// pages/index.js

import { useEffect, useState } from "react";

export default function Home() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch((err) => console.error("Error fetching products:", err));
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>DOBO Shop</h1>
      <p style={{ fontStyle: "italic", marginBottom: "1rem" }}>Planta una idea</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {products.map((product) => (
          <div
            key={product.id}
            style={{
              border: "1px solid #ccc",
              borderRadius: "0.5rem",
              padding: "1rem",
              textAlign: "center",
              backgroundColor: "#fff",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              transition: "transform 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {product.images?.edges[0]?.node?.url && (
              <img
                src={product.images.edges[0].node.url}
                alt={product.images.edges[0].node.altText || product.title}
                style={{ width: "100%", height: "auto", borderRadius: "0.5rem" }}
              />
            )}
            <h3 style={{ fontSize: "1.1rem", margin: "0.5rem 0" }}>{product.title}</h3>
            <p style={{ fontSize: "0.9rem", color: "#555" }}>{product.description}</p>
            <p style={{ fontWeight: "bold", fontSize: "1rem" }}>
              {product.variants?.edges[0]?.node?.price?.amount}{" 
