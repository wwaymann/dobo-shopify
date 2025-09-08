// lib/designStore.js

const kSession = (handle) => `dobo:design:session:${handle}`;
const kFinal   = (handle) => `dobo:design:final:${handle}`; // opcional local para debug

export function saveSessionDesign(handle, snapshot) {
  try {
    if (!handle) return;
    sessionStorage.setItem(kSession(handle), JSON.stringify({
      t: Date.now(),
      v: 1,
      snapshot
    }));
  } catch {}
}

export function loadSessionDesign(handle) {
  try {
    if (!handle) return null;
    const raw = sessionStorage.getItem(kSession(handle));
    if (!raw) return null;
    const { snapshot } = JSON.parse(raw);
    return snapshot || null;
  } catch { return null; }
}

export function clearSessionDesign(handle) {
  try { if (handle) sessionStorage.removeItem(kSession(handle)); } catch {}
}

// Opcional: guardado local de la versión final para pruebas
export function saveFinalLocal(handle, snapshot) {
  try { if (handle) localStorage.setItem(kFinal(handle), JSON.stringify(snapshot)); } catch {}
}
export function loadFinalLocal(handle) {
  try {
    if (!handle) return null;
    const raw = localStorage.getItem(kFinal(handle));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function clearFinalLocal(handle) {
  try { if (handle) localStorage.removeItem(kFinal(handle)); } catch {}
}
