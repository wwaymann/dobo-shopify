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

        if (!Array.isArray(data)) {
          console.error("Expected array from /api/products, got:", data);
          return;
        }

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

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>DOBO Shop</h1>
        <p className={styles.subtitle}>Planta una idea</p>

        {/* Zona de scroll horizontal por maceta */}
        <div className={styles.previewScroll}>
          <div className={styles.previewWrapper}>
            {selectedPot && (
              <div className={styles.preview}>
                <img
                  src={selectedPot.image}
                  alt={selectedPot.title}
                  className={styles.previewImg}
                />
                {selectedPlant && (
                  <img
                    src={selectedPlant.image}
                    alt="Planta"
                    className={styles.previewImgOverlay}
                  />
                )}
                {customText && (
                  <div className={styles.overlayText}>{customText}</div>
                )}
              </div>
            )}
          </div>
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
