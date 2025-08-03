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

  const potProducts = products.filter((p) => p.title.toLowerCase().includes("maceta"));
  const plantProducts = products.filter((p) => p.title.toLowerCase().includes("planta") || p.title.toLowerCase().includes("ficus"));

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>DOBO Shop</h1>
      <p className={styles.subtitle}>Planta una idea</p>

      <section className={styles.scrollZone + " " + styles.potZone}>
        <h2>Elige tu maceta</h2>
        <div className={styles.scrollContainer}>
          {potProducts.map((pot) => (
            <div
              key={pot.id}
              className={styles.card}
              onClick={() => setSelectedPot(pot)}
            >
              <img
                src={pot.image}
                alt={pot.title}
                className={styles.thumbnail}
              />
              <p>{pot.title}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.scrollZone + " " + styles.plantZone}>
        <h2>Elige tu planta</h2>
        <div className={styles.scrollContainer}>
          {plantProducts.map((plant) => (
            <div
              key={plant.id}
              className={styles.card}
              onClick={() => setSelectedPlant(plant)}
            >
              <img
                src={plant.image}
                alt={plant.title}
                className={styles.thumbnail}
              />
              <p>{plant.title}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.preview}>
        <h2>Vista previa</h2>
        <div className={styles.previewBox}>
          {selectedPot && (
            <img
              src={selectedPot.image}
              alt={selectedPot.title}
              className={styles.previewPot}
            />
          )}
          {selectedPlant && (
            <img
              src={selectedPlant.image}
              alt={selectedPlant.title}
              className={styles.previewPlant}
            />
          )}
          <div className={styles.overlayText}>Tu texto aquí</div>
        </div>

        {selectedPot && (
          <div className={styles.info}>
            <h3>{selectedPot.title}</h3>
            <p>{selectedPot.description}</p>
            <strong>${selectedPot.price}</strong>
            <br />
            <button className={styles.buyButton}>Comprar</button>
          </div>
        )}
      </section>

      <section>
        <h3>Imágenes de referencia</h3>
        {/* Aquí se mostrarían renders preestablecidos */}
      </section>
    </div>
  );
}
