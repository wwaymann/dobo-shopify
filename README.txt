DOBO Hotfix v11 — Import-to-Lazy
Además de los fixes anteriores, este paquete añade:
- scripts/fix-tdz-import-to-lazy.mjs
  Convierte imports ESM de nombres dados (p.ej. S) en import() dinámico con asignación diferida:
     let S; import('mod').then(m => { S = m.S });
  Esto rompe la TDZ cuando 'S' proviene de un módulo en ciclo.

Prebuild (Vercel) ya llama a:
  fix-tdz-default-params
  fix-tdz-reorder-top-level
  fix-tdz-predeclare-symbol S
  fix-tdz-import-to-lazy S

Pasos:
1) Copia todo en la raíz del repo.
2) Fusiona package.additions.json con tu package.json (scripts y devDependencies).
3) Asegura el archivo grande en components/CustomizationOverlay.impl.js
4) Commit & deploy.

Si el símbolo cambia (ej. STORE), añade otra llamada en prebuild:
  node scripts/fix-tdz-predeclare-symbol.mjs components/CustomizationOverlay.impl.js STORE
  node scripts/fix-tdz-import-to-lazy.mjs components/CustomizationOverlay.impl.js STORE
