import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { loadSessionDesign, saveSessionDesign } from '@/lib/designStore';

useEffect(() => {
  let cancelled = false;
  (async () => {
    const token = window.localStorage.getItem('customerAccessToken') || ''; // o desde tu auth
    const restored = await loadSessionDesign(product.id, token);
    if (!cancelled && restored) {
      // hidrata tu editor
      editorRef.current?.loadFromJSON(restored);
    }
  })();
  return () => { cancelled = true; };
}, [product.id]);

// Ejemplo de guardado tras cambios
const onDesignChange = (nextState) => {
  const token = window.localStorage.getItem('customerAccessToken') || '';
  saveSessionDesign(product.id, nextState, token);
};


export default function ProductPage() {
  const { query } = useRouter();
  useEffect(() => {
    if (!query.handle) return;
    (async () => {
      const r = await fetch(`/api/design/load?handle=${encodeURIComponent(query.handle)}`, { cache: 'no-store' });
      const d = await r.json();
      if (d?.designJSON?.json && window.doboDesignAPI?.applyDesignSnapshot) {
        window.doboDesignAPI.applyDesignSnapshot(d.designJSON);
      }
    })();
  }, [query.handle]);

  return (/* tu render */ null);
}
