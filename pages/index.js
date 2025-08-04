
import { useEffect, useState } from "react";

export default function Home() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        setProducts(data);
      } catch (err) {
        console.error("Error fetching products:", err);
      }
    };
    fetchProducts();
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h1>DOBO Shop</h1>
      <p>Planta una idea</p>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {Array.isArray(products) &&
          products.map((product, i) => (
            <div key={i} style={{ border: "1px solid #ccc", padding: 10 }}>
              <img src={product.image} alt={product.title} width="150" />
              <h3>{product.title}</h3>
              <p>{product.description}</p>
              <strong>${product.price}</strong>
            </div>
          ))}
      </div>
    </div>
  );
}
