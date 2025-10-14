// lib/checkout.js
// Helpers de checkout con Shopify Storefront API y fallback a /cart/add
import { getShopDomain } from "./shopDomain";

export const toGid = (id) => {
  const s = String(id || "");
  return s.includes("gid://")
    ? s
    : `gid://shopify/ProductVariant/${s.replace(/\D/g, "")}`;
};

// POST form fallback para /cart/add con properties
export function postCart(shop, mainVariantId, qty, attributes = [], accessoryVariantIds = [], returnTo = "/checkout") {
  const asStr = (v) => String(v || "").trim();
  const isNum = (v) => /^\d+$/.test(asStr(v));
  const gidToNum = (id) => {
    const s = asStr(id);
    return s.includes("gid://") ? s.split("/").pop() : s;
  };
  const main = isNum(mainVariantId) ? asStr(mainVariantId) : gidToNum(mainVariantId);
  if (!isNum(main)) throw new Error("variant-id-invalid");

  const form = document.createElement("form");
  form.method = "POST";
  form.action = `https://${shop}/cart/add`;
  form.target = "_top";
  const add = (n, v) => { const i = document.createElement("input"); i.type = "hidden"; i.name = n; i.value = String(v); form.appendChild(i); };

  let line = 0;
  const getA = (name) => {
    const n = name.toLowerCase();
    return (attributes || []).find((a) => {
      const k = (a.key || "").toLowerCase();
      return k === n || k === `_${n}`;
    })?.value || "";
  };

  const previewUrl = getA("DesignPreview"), designId = getA("DesignId"),
        designPlant = getA("DesignPlant"), designPot = getA("DesignPot"),
        designColor = getA("DesignColor"), designSize = getA("DesignSize"),
        designName = getA("DesignName") || getA("DoboName");

  add(`items[${line}][id]`, main);
  add(`items[${line}][quantity]`, String(qty || 1));
  add(`items[${line}][properties][_LinePriority]`, "0");
  if (previewUrl) add(`items[${line}][properties][_DesignPreview]`, previewUrl);
  if (designId) add(`items[${line}][properties][_DesignId]`, designId);
  if (designPlant) add(`items[${line}][properties][_DesignPlant]`, designPlant);
  if (designPot) add(`items[${line}][properties][_DesignPot]`, designPot);
  if (designColor) add(`items[${line}][properties][_DesignColor]`, designColor);
  if (designSize) add(`items[${line}][properties][_DesignSize]`, designSize);
  if (designName) add(`items[${line}][properties][_DesignName]`, designName);
  line++;

  accessoryVariantIds.forEach((id) => {
    const num = isNum(id) ? String(id) : gidToNum(id);
    if (!isNum(num)) return;
    add(`items[${line}][id]`, num);
    add(`items[${line}][quantity]`, "1");
    add(`items[${line}][properties][_Accessory]`, "true");
    add(`items[${line}][properties][_LinePriority]`, "1");
    line++;
  });

  if (returnTo) add("return_to", returnTo);
  document.body.appendChild(form);
  form.submit();
}

// Storefront API cartCreate y redirección
export async function cartCreateAndRedirect(lines) {
  const shop = getShopDomain();
  const token =
    process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;

  try {
    const endpoint = `https://${shop}/api/2024-07/graphql.json`;
    const q = `mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart { id webUrl }
        userErrors { field message }
      }
    }`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token || "",
      },
      body: JSON.stringify({
        query: q,
        variables: { input: { lines } },
      }),
    });

    const j = await res.json();
    const err = j?.errors?.[0]?.message || j?.data?.cartCreate?.userErrors?.[0]?.message;
    const webUrl = j?.data?.cartCreate?.cart?.webUrl;
    if (!res.ok || err || !webUrl) {
      throw new Error(err || `SF-HTTP-${res.status}`);
    }
    window.location.assign(webUrl);
    return;
  } catch (e) {
    console.warn("cartCreate fallback to /cart/add:", e);
    // Fallback: convertir las líneas a un form /cart/add
    // Espera lines = [{merchandiseId, quantity, attributes, ...}]
    if (!Array.isArray(lines) || lines.length === 0) throw e;
    const main = lines[0];
    const mainId = main?.merchandiseId || main?.variantId;
    const qty = Number(main?.quantity || 1);
    const attrs = (main?.attributes || []).map((a) => ({ key: a.key, value: a.value }));
    const accIds = lines.slice(1).map((l) => l.merchandiseId || l.variantId).filter(Boolean);

    postCart(shop, mainId, qty, attrs, accIds, "/checkout");
  }
}
