# Patch: DOBO — errores "S before initialization", SHOP_DOMAIN, Head y DOBO en checkout

Este ZIP contiene solo los archivos que debes **reemplazar/añadir**:

```
lib/shopDomain.js
lib/checkout.js
pages/api/design-product.js
pages/index.js
features/home/HomePage.jsx
```

## Qué corrige

1. **"Cannot access 'S' before initialization"**  
   Eliminamos duplicaciones/recursiones de helpers dentro del mismo módulo. `toGid`, `cartCreateAndRedirect` y `postCart` viven en **lib/checkout.js** y se importan **una vez** en HomePage.

2. **`SHOP_DOMAIN is not defined`**  
   Nuevo helper **getShopDomain()** en `lib/shopDomain.js`, con saneo de querystring/referrer + bloqueos a `vercel.*` y `localhost`.

3. **`Head is not defined` durante el build**  
   `pages/index.js` ahora importa `Head` de `next/head` y renderiza `HomePage` con `ssr:false`.

4. **Comprar ahora crea DOBO y muestra una sola línea en el checkout**  
   `HomePage.jsx` construye atributos cortos de DOBO y:
   - intenta **crear** un DOBO via `/api/design-product` (no bloquea si falla),
   - hace `cartCreate` por Storefront (o cae a `/cart/add` con `postCart`),  
   - agrega accesorios como líneas con `_Accessory=true`.

5. **Descripción corta (sin imágenes) en el DOBO**  
   El endpoint `pages/api/design-product.js` crea el producto con una **descripción corta**. Si envías `previewUrl`, intenta añadir la imagen de forma no bloqueante.

## Variables de entorno (Vercel)

- `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN` (o `NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN`)
- `NEXT_PUBLIC_SHOP_DOMAIN` **o** `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` → `um7xus-0u.myshopify.com`
- `SHOPIFY_SHOP` → `um7xus-0u.myshopify.com` (server)
- `SHOPIFY_ADMIN_TOKEN` (Admin API, para crear el DOBO)
- `SHOPIFY_PUBLICATION_ID` (opcional)

## Cómo aplicar
Copia los archivos de este ZIP en las mismas rutas de tu repo y despliega. Si tu `CustomizationOverlay` está en otra ruta, ajusta el import de `features/home/HomePage.jsx`.

> Si prefieres form POST directo (sin Storefront cartCreate), puedes comentar el `cartCreateAndRedirect` y quedarte con `postCart` en `HomePage.jsx`.
