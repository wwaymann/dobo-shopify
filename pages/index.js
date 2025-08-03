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
        <h1>DOBO Shop</h1>
        <p>Planta una idea</p>
      </header>

      <main className={styles.mainContent}>
        <section className={styles.scrollZone + " " + styles.potZone}>
          <h2>Elige tu maceta</h2>
          <div className={styles.scrollContainer}>
            {/* Aquí podrían renderizarse miniaturas de productos tipo maceta */}
          </div>
        </section>

        <section className={styles.previewZone}>
          {/* Previsualización central con imagen y texto */}
          <div className={styles.previewImage}>
            <img
              src={products[0]?.images?.edges[0]?.node?.url}
              alt={products[0]?.title || "Producto"}
            />
            <div className={styles.customText}>Tu texto aquí</div>
          </div>
        </section>

        <section className={styles.scrollZone + " " + styles.plantZone}>
          <h2>Elige tu planta</h2>
          <div className={styles.scrollContainer}>
            {/* Aquí podrían renderizarse miniaturas de productos tipo planta */}
          </div>
        </section>

        <section className={styles.detailsZone}>
          <h2>{products[0]?.title}</h2>
          <p>{products[0]?.description}</p>
          <p><strong>${products[0]?.variants?.edges[0]?.node?.price?.amount}</strong></p>
          <button className={styles.buyButton}>Comprar</button>
        </section>

        <section className={styles.referenceGallery}>
          <h3>Imágenes de referencia</h3>
          <div className={styles.galleryGrid}>
            {/* Aquí podrían ir imágenes de ambientación */}
          </div>
        </section>
      </main>
    </div>
  );
}
