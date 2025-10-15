DOBO Hotfix v12 — Advanced TDZ killer
- Añade `fix-tdz-default-params-advanced.mjs` (Babel) que mueve **cualquier** parámetro por defecto que referencie `S`
  hacia el cuerpo de la función (soporta funciones normales y arrow con cuerpo conciso).
- Mantiene: reorder top-level, predeclare symbol, import-to-lazy.

Prebuild ejecuta:
  1) ensure babel deps
  2) default-params-advanced (targets: S)
  3) default-params simple (fallback)
  4) reorder top-level
  5) predeclare S
  6) import-to-lazy S

Pasos:
  - Copia contenido en la raíz del repo
  - Fusiona package.additions.json en tu package.json
  - Asegura que el archivo grande esté en components/CustomizationOverlay.impl.js
  - Commit & deploy
