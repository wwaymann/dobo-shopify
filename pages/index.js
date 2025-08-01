// pages/index.js
import { useState, useEffect } from 'react';
import { getProducts } from '../lib/shopify';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [selectedPot, setSelectedPot] = useState(null);
  const [customText, setCustomText] = useState('DOBO');

  useEffect(() => {
    const fetchData = async () => {
      const data = await getProducts();
      setProducts(data);
      setSelectedPot(data[0]); // ejemplo: primer producto como maceta
      setSelectedPlant(data[1]); // ejemplo: segundo producto como planta
    };
    fetchData();
  }, []);

  return (
    <div className="container">
      <header>
        <h1>DOBO Shop</h1>
        <p>Planta una idea</p>
      </header>

      <section className="customizer">
        <div className="preview-area">
          <div className="scroll-row pots">
            {products.map((product, i) => (
              <img
                key={product.id}
                src={product.images[0]?.src}
                alt={product.title}
                className={selectedPot?.id === product.id ? 'selected' : ''}
                onClick={() => setSelectedPot(product)}
              />
            ))}
          </div>

          <div className="plant-overlay">
            {selectedPlant && (
              <img src={selectedPlant.images[0]?.src} alt={selectedPlant.title} />
            )}
            <div className="custom-text">{customText}</div>
          </div>

          <div className="scroll-row plants">
            {products.map((product, i) => (
              <img
                key={product.id + '-plant'}
                src={product.images[0]?.src}
                alt={product.title}
                className={selectedPlant?.id === product.id ? 'selected' : ''}
                onClick={() => setSelectedPlant(product)}
              />
            ))}
          </div>
        </div>

        <div className="custom-fields">
          <label>Texto personalizado</label>
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
          />

          <div>
            <label>Cantidad</label>
            <select>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </div>

          <button className="buy-btn">Comprar</button>
        </div>
      </section>

      <footer className="reference">
        <h2>Reference image</h2>
        <div className="reference-gallery">
          <div className="ref-img" />
          <div className="ref-img" />
          <div className="ref-img" />
        </div>
      </footer>

      <style jsx>{`
        .container {
          padding: 20px;
          font-family: sans-serif;
        }
        .customizer {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .scroll-row {
          display: flex;
          overflow-x: auto;
          gap: 10px;
          margin: 10px 0;
        }
        .scroll-row img {
          height: 100px;
          cursor: pointer;
        }
        .selected {
          border: 2px solid #000;
        }
        .plant-overlay {
          position: relative;
        }
        .plant-overlay img {
          width: 300px;
        }
        .custom-text {
          position: absolute;
          bottom: 10px;
          left: 10px;
          font-size: 24px;
          font-weight: bold;
        }
        .custom-fields {
          margin-top: 20px;
        }
        .buy-btn {
          margin-top: 10px;
          padding: 10px 20px;
          background: #eee;
          border: none;
          font-weight: bold;
        }
        .reference-gallery {
          display: flex;
          gap: 10px;
          margin-top: 10px;
        }
        .ref-img {
          width: 100px;
          height: 100px;
          background: #ccc;
        }
      `}</style>
    </div>
  );
}
