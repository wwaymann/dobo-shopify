// /hooks/useIframeAutosize.js
import { useEffect } from 'react';

export default function useIframeAutosize() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const inIframe = window.self !== window.top;
    if (!inIframe) return;

    let rAF = null;

    const post = () => {
      const h = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.body.clientHeight,
        document.documentElement.clientHeight
      );
      window.parent.postMessage({ type: 'DOBO_HEIGHT', px: h }, '*');
    };

    const onResize = () => {
      if (rAF) cancelAnimationFrame(rAF);
      rAF = requestAnimationFrame(post);
    };

    const obs = new ResizeObserver(onResize);
    obs.observe(document.body);

    window.addEventListener('load', post);
    window.addEventListener('resize', onResize);
    document.addEventListener('readystatechange', post);

    // Responder “ready” del padre
    const onMessage = (e) => {
      const data = e.data || {};
      if (data.type === 'DOBO_PARENT_READY') post();
    };
    window.addEventListener('message', onMessage, false);

    // Primer disparo
    post();

    return () => {
      window.removeEventListener('load', post);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('readystatechange', post);
      window.removeEventListener('message', onMessage);
      obs.disconnect();
      if (rAF) cancelAnimationFrame(rAF);
    };
  }, []);
}
