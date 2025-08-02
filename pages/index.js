
import React from 'react';
import '../styles/customizer.css';

export default function Home() {
  const [selectedPot, setSelectedPot] = React.useState(null);
  const [selectedPlant, setSelectedPlant] = React.useState(null);
  const [customText, setCustomText] = React.useState("DOBO");

  const pots = [
    "/pot1.png", "/pot2.png", "/pot3.png"
  ];
  const plants = [
    "/plant1.png", "/plant2.png", "/plant3.png"
  ];

  return (
    <div className="customizer-container">
      <h1>DOBO Shop</h1>
      <p>Planta una idea</p>

      <div className="product-preview">
        {selectedPot && <img src={selectedPot} alt="Maceta" />}
        {selectedPlant && <img src={selectedPlant} alt="Planta" style={{ position: 'absolute', top: 0 }} />}
        <div className="text-overlay">{customText}</div>
      </div>

      <div className="scroll-selector">
        {pots.map((pot, idx) => (
          <img key={idx} src={pot} onClick={() => setSelectedPot(pot)} className={pot === selectedPot ? "selected" : ""} />
        ))}
      </div>

      <div className="scroll-selector">
        {plants.map((plant, idx) => (
          <img key={idx} src={plant} onClick={() => setSelectedPlant(plant)} className={plant === selectedPlant ? "selected" : ""} />
        ))}
      </div>

      <input type="text" value={customText} onChange={(e) => setCustomText(e.target.value)} />

      <div className="info-section">
        <p>Descripción de planta y maceta seleccionadas...</p>
      </div>

      <button className="buy-button">Comprar</button>
    </div>
  );
}
