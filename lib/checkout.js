// lib/checkout.js
import { getShopDomain } from "./shopDomain";

export const toGid = (id) => {
  const s = String(id || "");
  return s.includes("gid://")
    ? s
    : `gid://shopify/ProductVariant/${s.replace(/\D/g, "")}`;
};

// Intenta Storefront cartCreate; si falla, fallback a /cart/add
export async function cartCreateAndRedirect(lines = []) {
  const shop = getShopDomain();
  const token =
    process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;
  if (!token) throw new Error("STOREFRONT_TOKEN missing");

  const endpoint = `https://${shop}/api/2024-07/graphql.json`;
  const mutation = `#graphql
    mutation CartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart { id checkoutUrl }
        userErrors { field message }
      }
    }`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query: mutation, variables: { input: { lines } } }),
  });

  let data = null;
  try { data = await res.json(); } catch {}
  const url = data?.data?.cartCreate?.cart?.checkoutUrl;
  const errs = data?.data?.cartCreate?.userErrors || [];
  if (url) {
    if (typeof window !== "undefined") window.top.location.href = url;
    return url;
  }
  console.warn("cartCreate userErrors:", errs);

  // Fallback a /cart/add
  const main = lines[0]?.merchandiseId;
  const qty = lines[0]?.quantity || 1;
  const props = lines[0]?.attributes || [];
  const accs = lines.slice(1).map((l) => l.merchandiseId);
  postCart(shop, main, qty, props, accs, "/checkout");
  return null;
}

// Fallback “seguro” a /cart/add con <form target="_top">
export function postCart(
  shop,
  mainVariantGidOrId,
  qty,
  attributes = [],
  accessoryGidsOrIds = [],
  returnTo
) {
  const asStr = (v) => String(v || "").trim();
  const isNum = (v) => /^\d+$/.test(asStr(v));
  const gidToNum = (id) => {
    const s = asStr(id);
    return s.includes("gid://") ? s.split("/").pop() : s;
    };

  const main = isNum(mainVariantGidOrId)
    ? asStr(mainVariantGidOrId)
    : gidToNum(mainVariantGidOrId);
  if (!/^\d+$/.test(main)) throw new Error("variant principal inválido");

  const accs = (accessoryGidsOrIds || [])
    .map((id) => (isNum(id) ? asStr(id) : gidToNum(id)))
    .filter((id) => /^\d+$/.test(id));

  const form = document.createElement("form");
  form.method = "POST";
  form.action = `https://${shop}/cart/add`;
  form.target = "_top";

  const add = (n, v) => {
    const i = document.createElement("input");
    i.type = "hidden"; i.name = n; i.value = String(v);
    form.appendChild(i);
  };

  let line = 0;

  const getA = (name) => {
    const n = String(name || "").toLowerCase();
    const cand = (attributes || []).find((a) => {
      const k = (a.key ?? a.name ?? "").toLowerCase();
      return k === n || k === `_${n}`;
    });
    return cand ? (cand.value ?? "") : "";
  };

  add(`items[${line}][id]`, main);
  add(`items[${line}][quantity]`, String(qty || 1));
  add(`items[${line}][properties][_LinePriority]`, "0");

  [
    "DesignPreview",
    "DesignLayer",
    "DesignId",
    "DesignPlant",
    "DesignPot",
    "DesignColor",
    "DesignSize",
    "DesignName",
    "dobo_layer_text_url",
    "dobo_layer_image_url",
  ].forEach((k) => {
    const v = getA(k);
    if (v) add(`items[${line}][properties][_${k}]`, v);
  });
  line++;

  accs.forEach((id) => {
    add(`items[${line}][id]`, id);
    add(`items[${line}][quantity]`, "1");
    add(`items[${line}][properties][_Accessory]`, "true");
    add(`items[${line}][properties][_LinePriority]`, "1");
    line++;
  });

  if (returnTo) add("return_to", returnTo);
  document.body.appendChild(form);
  form.submit();
}
