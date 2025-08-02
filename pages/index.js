import Head from 'next/head'
import { useState } from 'react'
import styles from '../styles/Home.module.css'

export default function Home() {
  const [selectedPot, setSelectedPot] = useState('/pot1.jpg')
  const [selectedPlant, setSelectedPlant] = useState('/plant1.png')
  const [customText, setCustomText] = useState('DOBO')
  const [quantity, setQuantity] = useState(1)

  return (
    <div className={styles.container}>
      <Head>
        <title>DOBO Shop</title>
      </Head>

      <header className={styles.header}>
        <h1>DOBO Shop</h1>
        <p>Planta una idea</p>
      </header>

      <main className={styles.main}>
        <div className={styles.preview}>
          <img src={selectedPot} alt="Maceta" className={styles.pot} />
          <img src={selectedPlant} alt="Planta" className={styles.plant} />
          <div className={styles.overlayText}>{customText}</div>
        </div>

        <div className={styles.selectors}>
          <div>
            <h3>Macetas</h3>
            <div className={styles.scrollRow}>
              {["/pot1.jpg","/pot2.jpg","/pot3.jpg"].map((src, i) => (
                <img key={i} src={src} alt={`Maceta ${i}`} onClick={() => setSelectedPot(src)} />
              ))}
            </div>
          </div>
          <div>
            <h3>Plantas</h3>
            <div className={styles.scrollRow}>
              {["/plant1.png","/plant2.png","/plant3.png"].map((src, i) => (
                <img key={i} src={src} alt={`Planta ${i}`} onClick={() => setSelectedPlant(src)} />
              ))}
            </div>
          </div>
        </div>

        <div className={styles.controls}>
          <input type="text" value={customText} onChange={e => setCustomText(e.target.value)} />
          <select value={quantity} onChange={e => setQuantity(e.target.value)}>
            {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button>Comprar</button>
        </div>

        <section>
          <h3>Reference image</h3>
          <div className={styles.reference}>
            {[1,2,3].map(i => <div key={i} className={styles.refBox}></div>)}
          </div>
        </section>
      </main>
    </div>
  )
}