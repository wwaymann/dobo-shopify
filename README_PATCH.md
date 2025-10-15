
# DOBO patch

This patch fixes:
- `Missing env` by resolving the shop domain on the client (`lib/shopDomain.js`).
- Creates a DOBO product via Admin REST in `pages/api/design-product.js` (needs `SHOPIFY_SHOP` and `SHOPIFY_ADMIN_TOKEN` envs).
- Stable `buyNow` / `addToCart` flow that posts a form to `https://{shop}/cart/add` and redirects to checkout.

## Required Environment Variables (Vercel)

- `SHOPIFY_SHOP` = your-shop.myshopify.com
- `SHOPIFY_ADMIN_TOKEN` = Admin API access token (private app / custom app).
- `SHOPIFY_PUBLICATION_ID` = (optional) publication to auto-publish new DOBO products.
- `SHOPIFY_COLLECTION_ID_DOBOS` = (optional) collection ID for the DOBO gallery.
- `NEXT_PUBLIC_SHOP_DOMAIN` or `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` = public domain for storefront (optional; fallback uses `SHOPIFY_SHOP`).

## How it integrates

- `features/home/HomePage.jsx`: we injected **one** helper block (search for `DOBO checkout helpers`) that exposes `addToCart` and `buyNow` helpers.
- Use it inside your component like:

```js
// gather attributes from your designer (or leave empty)
const attrs = [
  { key: "_DesignId", value: designId }, 
  { key: "Preview", value: previewUrl }
];

await buyNow({
  selectedVariant,        // keep your selected pot variant as fallback
  quantity,
  attributes: attrs,
  accessoryVariantIds,    // if you have accessories
  basePrice,              // pot + plant total
  meta: {
    title: `DOBO ${plantTitle} + ${potTitle}`,
    previewUrl,
    color: selectedColor,
    size: activeSize,
    designId,
    potTitle,
    plantTitle,
    shortDescription: "DOBO personalizado (planta + maceta).",
    metafields: {
      plant: plantTitle, pot: potTitle
    }
  }
});
```

If DOBO product creation fails, the helper falls back to the currently selected variant, so the user can still check out.

## Notes

- We **do not** call Storefront GraphQL for product creation; that must happen on the **Admin** API (done in `/api/design-product`).
- The `_DesignId` and preview URL are saved as metafields on the created product.
- The `/cart/add` form approach avoids client TDZ/cycle errors and works on any theme.

