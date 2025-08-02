import Head from 'next/head';
import { useState } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [pot, setPot] = useState('/images/pot1.png');
  const [plant, setPlant] = useState('/images/plant1.png');
  const [text, setText] = useState('DOBO');

  return (
    <div className={styles.container}>
      <Head>
        <title>DOBO Shop</title>
      </Head>
      <main className={styles.main}>
        <h1 className={styles.title}>DOBO Shop</h1>
        <p className={styles.subtitle}>Planta una idea</p>
        <div className={styles.customizer}>
          <div className={styles.scrollRow}>
            {[1,2,3,4].map(i => (
              <img key={i} src={`/images/pot${i}.png`} onClick={() => setPot(`/images/pot${i}.png`)} className={styles.thumb}/>
            ))}
          </div>
          <div className={styles.scrollRow}>
            {[1,2,3,4].map(i => (
              <img key={i} src={`/images/plant${i}.png`} onClick={() => setPlant(`/images/plant${i}.png`)} className={styles.thumb}/>
            ))}
          </div>
          <div className={styles.preview}>
            <img src={pot} className={styles.previewImg} />
            <img src={plant} className={styles.previewImgOverlay} />
            <div className={styles.overlayText}>{text}</div>
          </div>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={styles.textInput}
          />
          <button className={styles.buyButton}>Comprar</button>
        </div>
        <h2>Reference image</h2>
        <div className={styles.referenceRow}>
          {[1,2,3].map(i => (
            <div key={i} className={styles.referenceBox}></div>
          ))}
        </div>
      </main>
    </div>
  );
}