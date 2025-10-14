# DOBO Patches v6

Corrige:

- `SHOP_DOMAIN is not defined` → usa `getShopDomain()` en tiempo de ejecución.
- IDs Shopify en cart → envía `toNumericId(id)` al `postCart(...)`.
- No toca tu lógica de GraphQL; si falla, tus logs seguirán mostrando el aviso, pero el flujo puede continuar si tienes fallback.

## Cómo aplicar

1. Copia las carpetas `bin/` y `lib/` a la **raíz** de tu repo, o descomprime este zip en la raíz.
2. Ejecuta:
```bash
node bin/apply-patch.js
```
3. Reconstruye:
```bash
rm -rf .next
npm run dev
# o
npm run build && npm start
```

## Entorno requerido

Configura en local/Vercel según tu backend:

- `SHOPIFY_STORE_DOMAIN` (ej: `tutienda.myshopify.com`)
- `SHOPIFY_ADMIN_TOKEN` (si tus endpoints lo necesitan)
- Opcional `NEXT_PUBLIC_SHOP_DOMAIN` para forzar un dominio.

> El warning de `html2canvas` sobre `willReadFrequently` es solo de rendimiento.
