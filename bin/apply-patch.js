// bin/apply-patch.js
const fs = require("fs");
const path = require("path");

const TARGETS = [
  "features/home/HomePage.jsx",
  "src/features/home/HomePage.jsx",
  "pages/index.jsx",
  "pages/index.tsx",
  "pages/index.js"
];

function exists(p){ try { return fs.statSync(p).isFile(); } catch { return false; } }
function read(p){ return fs.readFileSync(p, "utf8"); }
function write(p, s){ fs.writeFileSync(p, s); }

function ensureImportHelpers(src) {
  const lineAlias = `import { getShopDomain, toNumericId, createDesignProductSafe } from "@/lib/checkoutHelpers";`;
  const lineRel = `import { getShopDomain, toNumericId, createDesignProductSafe } from "../lib/checkoutHelpers";`;
  if (/from ["'].*checkoutHelpers["']/.test(src)) return src;
  // si ya hay import React, insertamos debajo
  const m = src.match(/import[^\n]*\n/);
  if (m) {
    const imp = (src.includes("from "@/") || src.includes("from '@/")) ? lineAlias : lineRel;
    return src.replace(m[0], m[0] + imp + "\n");
  }
  return (lineRel + "\n" + src);
}

function replaceShopDomain(src) {
  return src.replace(/\bSHOP_DOMAIN\b/g, "getShopDomain()");
}

function wrapVariantInPostCart(src) {
  return src.replace(/postCart\(\s*([^,]+),\s*([^,]+),/g, (m, a1, a2) => {
    if (/toNumericId\s*\(/.test(a2)) return m;
    return `postCart(${a1}, toNumericId(${a2}),`;
  });
}

function patchHtml2Canvas(src) {
  return src.replace(/html2canvas\s*\(\s*([a-zA-Z0-9_.$]+)\s*,\s*\{([\s\S]*?)\}\s*\)/g, (m, el, obj) => {
    const extra = `windowWidth: (${el}.scrollWidth||${el}.clientWidth||window.innerWidth),
      windowHeight: (${el}.scrollHeight||${el}.clientHeight||window.innerHeight)`;
    if (obj.includes("windowWidth") || obj.includes("windowHeight")) return m;
    const body = obj.trim().replace(/^{|}$/g,"");
    return `html2canvas(${el}, { ${body}, ${extra} })`;
  });
}

function patchDesignProductBlock(src) {
  const re = /const\s+dpRes\s*=\s*await\s*fetch\(\s*["']\/api\/design-product["'][\s\S]*?postCart\([^)]*\);\s*/m;
  if (!re.test(src)) return src;
  const block = `
      // ---------- Seguro: crear producto de diseño o usar variante actual ----------
      let finalVariantId = null;
      try {
        const payload = {
          title: \`DOBO \${plants[selectedPlantIndex]?.title} + \${pots[selectedPotIndex]?.title}\`,
          previewUrl: attrs.find(a => a.key === "_DesignPreview")?.value || "",
          price: basePrice,
          color: selectedColor || "Único",
          size: activeSize || "Único",
          designId: attrs.find(a => a.key === "_DesignId")?.value,
          plantTitle: plants[selectedPlantIndex]?.title || "Planta",
          potTitle: pots[selectedPotIndex]?.title || "Maceta",
        };
        const dp = await createDesignProductSafe(payload);
        if (dp?.ok && dp.variantId) {
          finalVariantId = dp.variantId;
        } else {
          console.warn("GraphQL falló; usando fallback al variante seleccionado:", dp?.error);
          finalVariantId = selectedVariant?.id;
        }
      } catch (e) {
        console.warn("GraphQL falló; usando fallback al variante seleccionado:", e);
        finalVariantId = selectedVariant?.id;
      }
      try { const ready = await waitDesignerReady(12000); if (ready) { try { await publishDesignForVariant(finalVariantId); } catch {} } } catch {}
      const accIds = getAccessoryVariantIds();
      postCart(getShopDomain(), toNumericId(finalVariantId), quantity, attrs, accIds, "/checkout");
  `;
  return src.replace(re, block);
}

function ensureAppPolyfill(projectRoot) {
  const candidates = ["pages/_app.js", "pages/_app.jsx", "pages/_app.tsx"];
  let found = null;
  for (const rel of candidates) {
    const p = path.join(projectRoot, rel);
    if (exists(p)) { found = p; break; }
  }
  const importLine = `import "@/lib/canvasWillReadFrequently";`;
  if (found) {
    let s = read(found);
    if (!s.includes("canvasWillReadFrequently")) {
      s = importLine + "\n" + s;
      write(found, s);
      console.log("[ok] Polyfill inyectado en", found);
    } else {
      console.log("[skip] Polyfill ya presente en", found);
    }
  } else {
    const p = path.join(projectRoot, "pages/_app.js");
    const s = `${importLine}
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}`;
    fs.mkdirSync(path.dirname(p), { recursive: true });
    write(p, s);
    console.log("[ok] Creado", p);
  }
}

function run() {
  const projectRoot = process.cwd();
  // Copiar helpers
  const libSrc = path.join(__dirname, "..", "lib");
  const libDst = path.join(projectRoot, "lib");
  fs.mkdirSync(libDst, { recursive: true });
  for (const fn of ["checkoutHelpers.js","canvasWillReadFrequently.js"]) {
    const src = path.join(libSrc, fn);
    const dst = path.join(libDst, fn);
    if (!exists(dst)) {
      fs.copyFileSync(src, dst);
      console.log("[ok] copiado", "lib/"+fn);
    } else {
      console.log("[skip] ya existe", "lib/"+fn);
    }
  }

  ensureAppPolyfill(projectRoot);

  let patchedAny = false;
  for (const rel of TARGETS) {
    const p = path.join(projectRoot, rel);
    if (!exists(p)) continue;
    let src = read(p);
    const orig = src;

    src = ensureImportHelpers(src);
    src = replaceShopDomain(src);
    src = wrapVariantInPostCart(src);
    src = patchHtml2Canvas(src);
    src = patchDesignProductBlock(src);

    if (src !== orig) {
      write(p, src);
      patchedAny = true;
      console.log("[ok] Patched", rel);
    } else {
      console.log("[skip] Sin cambios en", rel);
    }
  }

  if (!patchedAny) {
    console.warn("[warn] No se encontró ningún target. Edita TARGETS en bin/apply-patch.js para apuntar al archivo correcto.");
  } else {
    console.log("[done] Parche aplicado.");
  }
}

if (require.main === module) run();
