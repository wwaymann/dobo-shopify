// pages/_app.js
import React, { useEffect, useRef, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/globals.css';
import Head from 'next/head';
import useIframeAutosize from '../hooks/useIframeAutosize';

/** Escala toda la app como un bloque sin tocar layout interno */
function Scaler({ children, minBaseWidth = 1200, maxScale = 1 }) {
  const wrapRef = useRef(null);
  const innerRef = useRef(null);
  const [baseWidth, setBaseWidth] = useState(minBaseWidth);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const calc = () => {
      const inner = innerRef.current;
      const wrap = wrapRef.current;
      // Detecta el ancho natural del contenido una vez montado
      const natural = Math.max(minBaseWidth, inner ? (inner.scrollWidth || inner.offsetWidth || minBaseWidth) : minBaseWidth);
      if (natural !== baseWidth) {
        setBaseWidth(natural);
      }
      const vw = Math.max(320, window.innerWidth || natural);
      const s = Math.min(maxScale, vw / natural);
      setScale(s);
      if (wrap && inner) {
        const h = (inner.offsetHeight || 0) * s;
        wrap.style.height = h + 'px';
      }
    };

    // Primer cálculo y listeners
    calc();
    const onR = () => calc();
    window.addEventListener('resize', onR);

    let ro;
    try {
      ro = new ResizeObserver(() => calc());
      if (innerRef.current) ro.observe(innerRef.current);
    } catch {}

    return () => {
      window.removeEventListener('resize', onR);
      try { ro && ro.disconnect(); } catch {}
    };
  }, [baseWidth, minBaseWidth, maxScale]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <div
        ref={innerRef}
        style={{
          width: baseWidth,
          margin: '0 auto',
          transform: `scale(${scale})`,
          transformOrigin: 'top center'
        }}
      >
        {children}
      </div>
    </div>
  );
}

function MyApp({ Component, pageProps }) {
  useIframeAutosize();
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Scaler>
        <Component {...pageProps} />
      </Scaler>
    </>
  );
}

export default MyApp;
