/* import { useEffect, useState } from "react";

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
/*

// pages/index.js

import { useEffect, useState } from "react";
import styles from "../styles/Home.module.css";

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
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>DOBO</h1>
        <p>Planta una idea</p>
      </header>

      <main className={styles.main}>
        <section className={styles.scrollZone + " " + styles.plantZone}>
          <h2>Elige tu planta</h2>
          <div className={styles.scrollContainer}>
            {/* Aquí podrían renderizarse miniaturas de productos tipo planta */}
          </div>
        </section>

        <section className={styles.previewZone}>
          {products[0] && (
            <div className={styles.productPreview}>
              <img src={products[0].image} alt={products[0].title} />
              <div className={styles.customTextOverlay}>Texto Personalizable</div>
            </div>
          )}
        </section>

        <section className={styles.scrollZone + " " + styles.potZone}>
          <h2>Elige tu maceta</h2>
          <div className={styles.scrollContainer}>
            {/* Aquí se mostrarían opciones de macetas */}
          </div>
        </section>

        <section className={styles.detailsZone}>
          <p>Descripción: {products[0]?.description}</p>
          <p>Precio: ${products[0]?.price}</p>
          <button className={styles.buyButton}>Comprar</button>
        </section>

        <section className={styles.galleryZone}>
          <h3>Referencias</h3>
          <div className={styles.gallery}>
            {/* Aquí pueden ir imágenes de ejemplos */}
          </div>
        </section>
      </main>
    </div>
  );
}
