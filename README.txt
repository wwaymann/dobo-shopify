DOBO Hotfix v9 — TDZ killer (predeclare)

Incluye wrapper + shims + proxies + source maps, y 3 codemods:
1) scripts/fix-tdz-default-params.mjs
2) scripts/fix-tdz-reorder-top-level.mjs
3) scripts/fix-tdz-predeclare-symbol.mjs   <-- nuevo

Uso recomendado sobre components/CustomizationOverlay.impl.js:
   node scripts/fix-tdz-default-params.mjs components/CustomizationOverlay.impl.js
   npm i -D @babel/parser @babel/traverse @babel/generator
   node scripts/fix-tdz-reorder-top-level.mjs components/CustomizationOverlay.impl.js
   node scripts/fix-tdz-predeclare-symbol.mjs components/CustomizationOverlay.impl.js S

Si aparece otro nombre de símbolo, vuelve a llamar el último script con ese nombre.
