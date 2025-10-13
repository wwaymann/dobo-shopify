DOBO Hotfix v7 — TDZ + lazy loading

Incluye:
- jsconfig.json (alias @/*)
- next.config.js (source maps)
- components/CustomizationOverlay.js (wrapper dinámico)
- features/components/CustomizationOverlay.js (shim para ../components/CustomizationOverlay)
- features/lib/designStore.js (proxy perezoso para ../lib/designStore)
- pages/index.js (passthrough a ../features/home/HomePage)
- scripts/fix-tdz-default-params.mjs (codemod)
Pasos:
1) Copia TODO en la raíz del repo (sobrescribe).
2) Renombra tu overlay grande a components/CustomizationOverlay.impl.js (si aún no).
3) Ejecuta:
   node scripts/fix-tdz-default-params.mjs components/CustomizationOverlay.impl.js
4) npm run build / deploy
