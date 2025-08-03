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

  const macetas = products.filter(p => p.title.toLowerCase().includes("maceta"));
  const plantas = products.filter(p => p.title.toLowerCase().includes("planta") || p.title.toLowerCase().includes("ficus"));
  const activeMaceta = macetas[0];

  return (
    <div className={styles.container}>
      <h1>DOBO Shop</h1>
      <p>Planta una idea</p>

      <section className={styles.scrollZone + " " + styles.potZone}>
        <h2>Elige tu maceta</h2>
        <div className={styles.scrollContainer}>
          {macetas.map((product, i) => (
            <div key={i} className={styles.thumbnailCard}>
              <img src={product.images?.edges[0]?.node?.url} alt={product.title} />
              <p>{product.title}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.previewZone}>
        {activeMaceta && (
          <>
            <img
              src={activeMaceta.images?.edges[0]?.node?.url}
              alt={activeMaceta.title}
              className={styles.previewImage}
            />
            <p>Tu texto aquí</p>
          </>
        )}
      </section>

      <section className={styles.scrollZone + " " + styles.plantZone}>
        <h2>Elige tu planta</h2>
        <div className={styles.scrollContainer}>
          {plantas.map((product, i) => (
            <div key={i} className={styles.thumbnailCard}>
              <img src={product.images?.edges[0]?.node?.url} alt={product.title} />
              <p>{product.title}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.detailsZone}>
        {activeMaceta && (
          <>
            <h3>{activeMaceta.title}</h3>
            <p>{activeMaceta.description}</p>
            <p>
              ${
                activeMaceta.variants?.edges[0]?.node?.price?.amount || "N/A"
              }
            </p>
            <button className={styles.buyButton}>Comprar</button>
          </>
        )}
      </section>

      <section className={styles.galleryZone}>
        <h2>Imágenes de referencia</h2>
        {/* Aquí podrías poner imágenes de productos en uso */}
      </section>
    </div>
  );
}
