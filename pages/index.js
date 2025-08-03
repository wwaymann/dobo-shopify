// pages/index.js

import { useEffect, useState } from "react";
import styles from "../styles/home.module.css";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [selectedMaceta, setSelectedMaceta] = useState(null);
  const [selectedPlanta, setSelectedPlanta] = useState(null);
  const [customText, setCustomText] = useState("Tu texto aquí");

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch((err) => console.error("Error fetching products:", err));
  }, []);

  const macetas = products.filter((p) => p.title.toLowerCase().includes("maceta"));
  const plantas = products.filter((p) => p.title.toLowerCase().includes("planta"));

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>DOBO Shop</h1>
        <p className={styles.subtitle}>Planta una idea</p>

        <section>
          <h2>Elige tu maceta</h2>
          <div className={styles.scrollRow}>
            {macetas.map((product, index) => (
              <img
                key={index}
                src={product.image}
                alt={product.title}
                className={styles.thumb}
                onClick={() => setSelectedMaceta(product)}
              />
            ))}
          </div>
        </section>

        <section>
          <h2>Elige tu planta</h2>
          <div className={styles.scrollRow}>
            {plantas.map((product, index) => (
              <img
                key={index}
                src={product.image}
                alt={product.title}
                className={styles.thumb}
                onClick={() => setSelectedPlanta(product)}
              />
            ))}
          </div>
        </section>

        <div className={styles.preview}>
          {selectedMaceta && (
            <img
              src={selectedMaceta.image}
              alt={selectedMaceta.title}
              className={styles.previewImg}
            />
          )}
          {selectedPlanta && (
            <img
              src={selectedPlanta.image}
              alt={selectedPlanta.title}
              className={styles.previewImgOverlay}
            />
          )}
          <div className={styles.overlayText}>{customText}</div>
        </div>

        <input
          type="text"
          placeholder="Texto personalizado"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          className={styles.textInput}
        />

        <button className={styles.buyButton}>Comprar</button>

        <section>
          <h3>Imágenes de referencia</h3>
          <div className={styles.referenceRow}>
            <div className={styles.referenceBox}></div>
            <div className={styles.referenceBox}></div>
            <div className={styles.referenceBox}></div>
          </div>
        </section>
      </main>
    </div>
  );
}
