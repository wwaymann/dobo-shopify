¿// pages/index.js
import { useEffect, useState } from "react";
import styles from "../styles/home.module.css";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [selectedMaceta, setSelectedMaceta] = useState(null);
  const [selectedPlanta, setSelectedPlanta] = useState(null);
  const [customText, setCustomText] = useState("DOBO");

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch((err) => console.error("Error fetching products:", err));
  }, []);

  const macetas = products.filter((p) => p.title.toLowerCase().includes("maceta"));
  const plantas = products.filter((p) => p.title.toLowerCase().includes("planta") || p.title.toLowerCase().includes("ficus"));

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>DOBO Shop</h1>
        <p className={styles.subtitle}>Planta una idea</p>

        {/* Zona de selección de macetas */}
        <section className={styles.scrollZone + " " + styles.potZone}>
          <h2>Elige tu maceta</h2>
          <div className={styles.scrollRow}>
            {macetas.map((maceta, i) => (
              <img
                key={i}
                src={maceta.image}
                alt={maceta.title}
                className={styles.thumb}
                onClick={() => setSelectedMaceta(maceta)}
              />
            ))}
          </div>
        </section>

        {/* Zona de selección de plantas */}
        <section className={styles.scrollZone + " " + styles.plantZone}>
          <h2>Elige tu planta</h2>
          <div className={styles.scrollRow}>
            {plantas.map((planta, i) => (
              <img
                key={i}
                src={planta.image}
                alt={planta.title}
                className={styles.thumb}
                onClick={() => setSelectedPlanta(planta)}
              />
            ))}
          </div>
        </section>

        {/* Vista previa */}
        <div className={styles.preview}>
          {selectedMaceta && (
            <img
              src={selectedMaceta.image}
              alt="Maceta seleccionada"
              className={styles.previewImg}
            />
          )}
          {selectedPlanta && (
            <img
              src={selectedPlanta.image}
              alt="Planta seleccionada"
              className={styles.previewImgOverlay}
            />
          )}
          <div className={styles.overlayText}>{customText}</div>
        </div>

        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Texto personalizado"
          className={styles.textInput}
        />

        <button className={styles.buyButton}>Comprar</button>

        {/* Galería de referencia */}
        <h3 style={{ marginTop: "2rem" }}>Imágenes de referencia</h3>
        <div className={styles.referenceRow}>
          {[1, 2, 3].map((n) => (
            <div key={n} className={styles.referenceBox}></div>
          ))}
        </div>
      </main>
    </div>
  );
}
