// pages/index.js

import { useEffect, useState } from "react";
import styles from "../styles/Home.module.css";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [selectedPot, setSelectedPot] = useState(null);
  const [selectedPlant, setSelectedPlant] = useState(null);

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

  const pots = products.filter((p) => p.title.toLowerCase().includes("maceta"));
  const plants = products.filter((p) => p.title.toLowerCase().includes("planta") || p.title.toLowerCase().includes("ficus"));

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>DOBO Shop</h1>
      <p className={styles.subtitle}>Planta una idea</p>

      {/* Scroll zona para elegir maceta */}
      <section className={styles.scrollZone + " " + styles.potZone}>
        <h2>Elige tu maceta</h2>
        <div className={styles.scrollContainer}>
          {pots.map((product, i) => (
            <img
              key={i}
              src={product.image}
              alt={product.title}
              className={styles.thumbnail + (selectedPot?.id === product.id ? " " + styles.selected : "")}
              onClick={() => setSelectedPot(product)}
            />
          ))}
        </div>
      </section>

      {/* Scroll zona para elegir planta */}
      <section className={styles.scrollZone + " " + styles.plantZone}>
        <h2>Elige tu planta</h2>
        <div className={styles.scrollContainer}>
          {plants.map((product, i) => (
            <img
              key={i}
              src={product.image}
              alt={product.title}
              className={styles.thumbnail + (selectedPlant?.id === product.id ? " " + styles.selected : "")}
              onClick={() => setSelectedPlant(product)}
            />
          ))}
        </div>
      </section>

      {/* Vista previa combinada */}
      <section className={styles.previewZone}>
        {selectedPot && (
          <div className={styles.potPreview}>
            <img src={selectedPot.image} alt={selectedPot.title} className={styles.previewImage} />
            <div className={styles.overlayText}>Tu texto aquí</div>
            {selectedPlant && (
              <img src={selectedPlant.image} alt={selectedPlant.title} className={styles.plantOverlay} />
            )}
          </div>
        )}
      </section>

      {/* Info producto y comprar */}
      {selectedPot && (
        <div className={styles.productInfo}>
          <h3>{selectedPot.title}</h3>
          <p>{selectedPot.description}</p>
          <strong>${selectedPot.price}</strong>
          <button className={styles.buyButton}>Comprar</button>
        </div>
      )}

      <h4 className={styles.referenceLabel}>Imágenes de referencia</h4>
    </div>
  );
}
