// pages/index.js
import { useEffect, useState } from "react";
import styles from "../styles/home.module.css";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [selectedPot, setSelectedPot] = useState(null);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [customText, setCustomText] = useState("DOBO");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        setProducts(data);
        const pot = data.find(p => p.title.toLowerCase().includes("maceta"));
        const plant = data.find(p => p.title.toLowerCase().includes("planta"));
        if (pot) setSelectedPot(pot);
        if (plant) setSelectedPlant(plant);
      } catch (err) {
        console.error("Error fetching products:", err);
      }
    };
    fetchProducts();
  }, []);

  const pots = products.filter(p => p.title.toLowerCase().includes("maceta"));
  const plants = products.filter(p => p.title.toLowerCase().includes("planta"));

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>DOBO Shop</h1>
        <p className={styles.subtitle}>Planta una idea</p>

        <section className={styles.scrollZone + " " + styles.potZone}>
          <h2>Elige tu maceta</h2>
          <div className={styles.scrollRow}>
            {pots.map((p, i) => (
              <img
                key={i}
                src={p.image}
                alt={p.title}
                className={
                  styles.thumb +
                  (selectedPot?.id === p.id ? " " + styles.thumbSelected : "")
                }
                onClick={() => setSelectedPot(p)}
              />
            ))}
          </div>
        </section>

        <section className={styles.scrollZone + " " + styles.plantZone}>
          <h2>Elige tu planta</h2>
          <div className={styles.scrollRow}>
            {plants.map((p, i) => (
              <img
                key={i}
                src={p.image}
                alt={p.title}
                className={
                  styles.thumb +
                  (selectedPlant?.id === p.id ? " " + styles.thumbSelected : "")
                }
                onClick={() => setSelectedPlant(p)}
              />
            ))}
          </div>
        </section>

        <div className={styles.preview}>
          {selectedPot && (
            <img src={selectedPot.image} alt="Maceta" className={styles.previewImg} />
          )}
          {selectedPlant && (
            <img src={selectedPlant.image} alt="Planta" className={styles.previewImgOverlay} />
          )}
          {customText && (
            <div className={styles.overlayText}>{customText}</div>
          )}
        </div>

        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          className={styles.textInput}
        />
        <button className={styles.buyButton}>Comprar</button>

        <h3>Imágenes de referencia</h3>
        <div className={styles.referenceRow}>
          <div className={styles.referenceBox}></div>
          <div className={styles.referenceBox}></div>
          <div className={styles.referenceBox}></div>
        </div>
      </main>
    </div>
  );
}
