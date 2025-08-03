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
        // Por defecto, asignar primera maceta y planta
        const pots = data.filter(p => p.title.toLowerCase().includes("maceta"));
        const plants = data.filter(p => p.title.toLowerCase().includes("planta") || p.title.toLowerCase().includes("ficus"));
        setSelectedPot(pots[0] || null);
        setSelectedPlant(plants[0] || null);
      } catch (err) {
        console.error("Error fetching products:", err);
      }
    };
    fetchProducts();
  }, []);

  return (
    <div className={styles.container}>
      <h1>DOBO Shop</h1>
      <p>Planta una idea</p>

      <section className={styles.scrollZone + " " + styles.potZone}>
        <h2>Elige tu maceta</h2>
        <div className={styles.scrollContainer}>
          {products
            .filter(p => p.title.toLowerCase().includes("maceta"))
            .map((product, i) => (
              <img
                key={i}
                src={product.image}
                alt={product.title}
                onClick={() => setSelectedPot(product)}
                className={styles.thumb}
              />
            ))}
        </div>
      </section>

      <section className={styles.previewZone}>
        {selectedPot && (
          <div>
            <img
              src={selectedPot.image}
              alt={selectedPot.title}
              className={styles.previewImage}
            />
            <div className={styles.overlayText}>Tu texto aquí</div>
          </div>
        )}
      </section>

      <section className={styles.scrollZone + " " + styles.plantZone}>
        <h2>Elige tu planta</h2>
        <div className={styles.scrollContainer}>
          {products
            .filter(p => p.title.toLowerCase().includes("planta") || p.title.toLowerCase().includes("ficus"))
            .map((product, i) => (
              <img
                key={i}
                src={product.image}
                alt={product.title}
                onClick={() => setSelectedPlant(product)}
                className={styles.thumb}
              />
            ))}
        </div>
      </section>

      {selectedPot && (
        <section>
          <h3>{selectedPot.title}</h3>
          <p>{selectedPot.description}</p>
          <strong>${selectedPot.price}</strong>
          <br />
          <button className={styles.buyButton}>Comprar</button>
        </section>
      )}

      <section>
        <h3>Imágenes de referencia</h3>
        {/* Aquí podrías agregar imágenes inspiradoras */}
      </section>
    </div>
  );
}
