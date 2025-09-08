import { useRouter } from 'next/router';
import { useEffect } from 'react';

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
