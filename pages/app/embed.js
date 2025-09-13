// pages/app/embed.js
import { useEffect, useState } from 'react';

export default function Embed() {
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const designUrl = params.get('designUrl');
    if (!designUrl) { setStatus('no-design'); return; }

    let cancelled = false;
    (async () => {
      try {
        setStatus('fetching');
        const resp = await fetch(designUrl, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`fetch ${resp.status}`);
        const payload = await resp.json();
        const snapshot = payload?.design || payload;

        setStatus('waiting-api');
        for (let i = 0; i < 60; i++) {
          if (cancelled) return;
          const api = window.doboDesignAPI;
          if (api && (api.loadDesignSnapshot || api.importDesignSnapshot || api.loadJSON)) {
            try {
              if (api.reset) api.reset();
              if (api.loadDesignSnapshot) api.loadDesignSnapshot(snapshot);
              else if (api.importDesignSnapshot) api.importDesignSnapshot(snapshot);
              else if (api.loadJSON) api.loadJSON(snapshot);
              setStatus('loaded');
            } catch { setStatus('api-error'); }
            return;
          }
          await new Promise(r => setTimeout(r, 200));
        }
        setStatus('api-timeout');
      } catch { setStatus('error'); }
    })();

    return () => { cancelled = true; };
  }, []);

  return null;
}
