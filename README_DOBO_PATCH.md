# DOBO Patch (checkout + DOBO product)

## Qué incluye
- `lib/checkout.js`: checkout seguro en cliente (Storefront cartCreate con degradación a `/cart/add` si falta token). **Nunca** lanza "Missing env".
- `lib/shopDomain.js`: resolución robusta del dominio de la tienda en cliente.
- `pages/api/design-product.js`: crea/actualiza un producto DOBO y devuelve `variantId`. Publica si `SHOPIFY_PUBLICATION_ID` está definido.

## Variables en Vercel
Cliente (NEXT_PUBLIC):
- `NEXT_PUBLIC_SHOP_DOMAIN` = `um7xus-0u.myshopify.com`
- `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN` **o** `NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN`

Servidor:
- `SHOPIFY_SHOP` = `um7xus-0u.myshopify.com`
- `SHOPIFY_ADMIN_TOKEN` = token Admin (no público)
- (opcional) `SHOPIFY_PUBLICATION_ID`

**Re-Deploy** después de cambiar variables.

## Integra en tu proyecto
1. Copia los archivos a las mismas rutas.
2. Borra/renombra cualquier helper viejo que exporte `cartCreateAndRedirect` o lance `"Missing env"` (p. ej. `lib/shopifyStorefront.js`).
3. En tu `HomePage.jsx` (o donde llames “Comprar ahora”):

```js
import { cartCreateAndRedirect, toGid, debugEnvLog } from "../../lib/checkout";

useEffect(() => { debugEnvLog(); }, []);

async function buyNow() {
  try {
    // 1) Atributos de línea
    const attrs = [
      { key: "_DesignId", value: `dobo-${Date.now()}` },
      { key: "_LinePriority", value: "0" },
      // agrega _DesignPreview/_DesignColor/_DesignSize si los generas
    ];

    // 2) Intenta crear producto DOBO (no bloquea si falla; hay fallback)
    let dp = null;
    try {
      const price = /* tu cálculo base */ 9900;
      const resp = await fetch("/api/design-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `DOBO ${plants[selectedPlantIndex]?.title} + ${pots[selectedPotIndex]?.title}`,
          previewUrl: "", // si ya subiste Cloudinary/URL
          price,
          color: selectedColor || "Único",
          size: activeSize || "Único",
          designId: attrs.find(a => a.key === "_DesignId")?.value,
          plantTitle: plants[selectedPlantIndex]?.title,
          potTitle: pots[selectedPotIndex]?.title,
          shortDescription: "Diseño DOBO personalizado",
        }),
      });
      dp = await resp.json().catch(() => null);
      if (!resp.ok || !dp?.variantId) dp = null;
    } catch {}

    // 3) Líneas para el carrito
    const mainVariant = dp?.variantId || (
      selectedVariant?.id || pots?.[selectedPotIndex]?.variants?.[0]?.id
    );
    if (!mainVariant) throw new Error("variant-missing");

    const lines = [
      { merchandiseId: toGid(mainVariant), quantity, attributes: attrs },
      ...(getAccessoryVariantIds?.() || []).map((id) => ({
        merchandiseId: toGid(id),
        quantity: 1,
        attributes: [{ key: "_Accessory", value: "true" }],
      })),
    ];

    // 4) Checkout
    await cartCreateAndRedirect(lines, [{ key: "_LinePriority", value: "0" }]);
  } catch (e) {
    alert(`No se pudo iniciar el checkout: ${e?.message || e}`);
  }
}
```

## Verificación
- Abre la consola del navegador: debe aparecer `"[DOBO env]" ... token_present: true`.
- Si `token_present: false`, igualmente debe redirigir con `/cart/add` y no romper.
- Tras comprar, debería verse el producto DOBO (si el API Admin está bien configurado) o al menos el fallback al variant seleccionado.
