// lib/checkout.js
// Checkout robusto con degradación automática a /cart/add si falta token.
// Evita “Missing env” como error fatal en cliente.

function sanitizeDomain(d) {
  return String(d || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/g, "")
    .toLowerCase();
}

export const toGid = (id) => {
  const s = String(id || "");
  return s.includes("gid://")
    ? s
    : `gid://shopify/ProductVariant/${s.replace(/\D/g, "")}`;
};

export function resolveShopDomain() {
  let domain =
    process.env.NEXT_PUBLIC_SHOP_DOMAIN ||
    process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ||
    process.env.SHOPIFY_SHOP ||
    "";

  domain = sanitizeDomain(domain);
  if (!domain) domain = "um7xus-0u.myshopify.com";

  const BAD = ["vercel.app", "vercel.com", "localhost", "127.0.0.1"];
  if (BAD.some((b) => domain.endsWith(b))) domain = "um7xus-0u.myshopify.com";
  return domain;
}

export function resolveStorefrontToken() {
  return (
    process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN ||
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
    process.env.SHOPIFY_STOREFRONT_TOKEN ||
    ""
  );
}

export function debugEnvLog() {
  // No mostramos el token, solo si existe
  // eslint-disable-next-line no-console
  console.log("[DOBO env]", {
    shop: resolveShopDomain(),
    token_present: !!resolveStorefrontToken(),
    vars: {
      NEXT_PUBLIC_SHOP_DOMAIN: !!process.env.NEXT_PUBLIC_SHOP_DOMAIN,
      NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN:
        !!process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN,
      SHOPIFY_SHOP: !!process.env.SHOPIFY_SHOP,
      NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN:
        !!process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN,
      NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN:
        !!process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN,
    },
  });
}

// --- Fallback a /cart/add ---
function formPostCartAdd(shop, lines = [], cartAttributes = [], returnTo = "/checkout") {
  const f = document.createElement("form");
  f.method = "POST";
  f.action = `https://${shop}/cart/add`;
  f.target = "_top";
  const add = (n, v) => {
    const i = document.createElement("input");
    i.type = "hidden";
    i.name = n;
    i.value = String(v);
    f.appendChild(i);
  };

  let li = 0;
  const addProps = (idx, props = []) =>
    props.forEach(({ key, value }) =>
      add(`items[${idx}][properties][${key}]`, String(value ?? ""))
    );

  // Aplanar lines (merchandiseId GID → num id)
  lines.forEach((ln) => {
    const gid = String(ln?.merchandiseId || "");
    const numId = gid.includes("gid://")
      ? gid.split("/").pop()?.replace(/\D/g, "")
      : String(gid).replace(/\D/g, "");
    if (!numId) return;
    add(`items[${li}][id]`, numId);
    add(`items[${li}][quantity]`, String(ln?.quantity || 1));
    addProps(li, ln?.attributes || []);
    li++;
  });

  // Atributos a nivel carrito (Shopify no los soporta directo en /cart/add, pero conservamos return_to)
  add("return_to", returnTo);

  document.body.appendChild(f);
  f.submit();
}

export async function cartCreateAndRedirect(lines, cartAttributes = []) {
  const shop = resolveShopDomain();
  const token = resolveStorefrontToken();

  // Si falta token, degradar silenciosamente a /cart/add
  if (!token) {
    console.warn("[DOBO] Storefront token ausente → degradando a /cart/add");
    if (typeof window !== "undefined") {
      formPostCartAdd(shop, lines, cartAttributes, "/checkout");
    }
    return null;
  }

  const endpoint = `https://${shop}/api/2024-07/graphql.json`;
  const mutation = `
    mutation CartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart { id checkoutUrl }
        userErrors { field message }
      }
    }`;

  const body = {
    query: mutation,
    variables: {
      input: {
        lines,
        attributes: (cartAttributes || []).map((kv) => ({
          key: String(kv?.key || ""),
          value: String(kv?.value ?? ""),
        })),
      },
    },
  };

  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify(body),
  });

  const json = await r.json().catch(() => ({}));
  const gqlErrors = json?.errors?.map((e) => e?.message).filter(Boolean) || [];
  const userErrors = json?.data?.cartCreate?.userErrors || [];

  if (!r.ok || gqlErrors.length || userErrors.length) {
    const msg =
      gqlErrors[0] ||
      userErrors[0]?.message ||
      `HTTP ${r.status} al crear carrito`;

    // Si el endpoint falla por permisos/token incorrecto, degradar a /cart/add
    console.warn("[DOBO] cartCreate falló, degradando a /cart/add:", msg);
    if (typeof window !== "undefined") {
      formPostCartAdd(shop, lines, cartAttributes, "/checkout");
    }
    return null;
  }

  const checkoutUrl = json?.data?.cartCreate?.cart?.checkoutUrl;
  if (!checkoutUrl) {
    console.warn("[DOBO] cartCreate sin checkoutUrl → degradando a /cart/add");
    if (typeof window !== "undefined") {
      formPostCartAdd(shop, lines, cartAttributes, "/checkout");
    }
    return null;
  }

  if (typeof window !== "undefined") window.location.assign(checkoutUrl);
  return checkoutUrl;
}
