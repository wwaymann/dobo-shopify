# Arreglo TDZ – "Cannot access 'S' before initialization"
1) Cambia `const S = (...) => {}` por `function S(...) {}` o mueve la declaración **arriba de su primer uso**.
2) Si `S` viene de otro módulo y hay **ciclo de imports**, carga `S` de forma **dinámica**:
```js
let S;
async function ensureS(){ if(!S){ const mod = await import("../lib/loquesea"); S = mod.S; } return S; }
```
3) Limpia `.next/` y vuelve a ejecutar el build.
