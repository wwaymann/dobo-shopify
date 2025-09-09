const LS_KEY = (pid) => `dobo:design:${pid}`;

export async function saveSessionDesign(productId, designObj, customerAccessToken) {
  try { localStorage.setItem(LS_KEY(productId), JSON.stringify(designObj)); } catch {}
  if (customerAccessToken) {
    try {
      await fetch('/api/design/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerAccessToken}` },
        body: JSON.stringify({ productId, jsonValue: designObj }),
      });
    } catch {}
  }
}

export async function loadSessionDesign(productId, customerAccessToken) {
  if (customerAccessToken) {
    try {
      const r = await fetch(`/api/design/get?productId=${encodeURIComponent(productId)}`, {
        headers: { Authorization: `Bearer ${customerAccessToken}` },
      });
      const j = await r.json();
      if (j?.value) return JSON.parse(j.value);
    } catch {}
  }
  try {
    const raw = localStorage.getItem(LS_KEY(productId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}
