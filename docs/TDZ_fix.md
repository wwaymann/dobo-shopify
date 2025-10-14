# Arreglo TDZ – "Cannot access 'S' before initialization"
Si el navegador cae en `CustomizationOverlay.impl.js:161`, hay dos orígenes típicos:

1) **Orden de definición/uso**
   Cambia `const S = (...) => {}` por `function S(...) {}` **o** mueve la declaración **antes** del primer uso.

2) **Ciclo de imports entre módulos**
   En lugar de importar estático, carga bajo demanda:
```js
let S;
async function ensureS(){ if(!S){ const mod = await import("../lib/loquesea"); S = mod.S; } return S; }
```
y usa `await ensureS()` donde lo necesites (p.ej. dentro de `useEffect`).

No olvides borrar `.next/` y reconstruir.
