DOBO Hotfix v8 — TDZ killer pack

Incluye:
- Wrapper dinámico del Overlay y shims (igual que v6/v7)
- Proxy perezoso para ../lib/designStore
- Source maps en prod
- 2 codemods:
  a) scripts/fix-tdz-default-params.mjs   -> mueve defaults de parámetros al cuerpo de la función
  b) scripts/fix-tdz-reorder-top-level.mjs -> reordena declaraciones top-level antes de su primera referencia (Babel)

Uso recomendado sobre `components/CustomizationOverlay.impl.js`:
1) Copia TODO en la raíz del repo (sobrescribe).
2) Asegúrate: tu overlay grande vive en components/CustomizationOverlay.impl.js
3) Ejecuta:
   node scripts/fix-tdz-default-params.mjs components/CustomizationOverlay.impl.js
   npm i -D @babel/parser @babel/traverse @babel/generator
   node scripts/fix-tdz-reorder-top-level.mjs components/CustomizationOverlay.impl.js
4) npm run build

Con esto eliminamos:
- Defaults que referencian símbolos aún no inicializados (causa #1 del "Cannot access 'S' before initialization")
- Referencias top-level que ocurren antes de la declaración correspondiente.

Si aún falla, el stack (gracias a source maps) te dirá la línea exacta. Pásamela y te mando un patch específico.
