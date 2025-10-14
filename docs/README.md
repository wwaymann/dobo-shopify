# DOBO Parches v5
## Qué arregla
- `SHOP_DOMAIN is not defined` → se reemplaza por `getShopDomain()` robusto.
- GraphQL `/api/design-product` fallando → `createDesignProductSafe()` con fallback automático a la variante seleccionada.
- IDs `gid://` → `toNumericId()` antes de pasar al checkout.
- Advertencias de Canvas → polyfill `willReadFrequently` y parámetros para `html2canvas`.
## Cómo aplicar
1. Copia esta carpeta a la raíz y ejecuta:
   ```bash
   node bin/apply-patch.js
   ```
2. Limpia caché y levanta:
   ```bash
   rm -rf .next
   npm run dev
   # o build
   npm run build && npm start
   ```
