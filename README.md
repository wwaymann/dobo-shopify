# DOBO – Parches v3
1) Descomprime este zip en la **raíz** de tu repo.
2) Ejecuta: `node bin/apply-patch.js`
3) Arranca de nuevo: `npm run dev` o compila `npm run build`.

Incluye:
- `lib/canvasWillReadFrequently.js` (mejora html2canvas/Canvas2D)
- `lib/checkoutHelpers.js` (getShopDomain, toNumericId, createDesignProductSafe)
- `bin/apply-patch.js` (aplica parches a HomePage.jsx/index.* y _app)
- `docs/TDZ_fix.md` (guía para el error "S" TDZ)
