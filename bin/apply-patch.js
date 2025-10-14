// bin/apply-patch.js
/**
 * Uso:
 *   node bin/apply-patch.js
 * - Inserta imports de helpers
 * - Reemplaza usos de SHOP_DOMAIN por getShopDomain()
 * - Fortalece buyNow() con fallback y toNumericId(...)
 * - Parchea html2canvas con windowWidth/windowHeight
 * - Injecta polyfill canvas en pages/_app.*
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
function r(...p){ return path.join(ROOT, ...p); }

function readIf(p){ try { return fs.readFileSync(p, "utf8"); } catch { return null; } }
function write(p, s){ fs.mkdirSync(path.dirname(p), { recursive:true }); fs.writeFileSync(p, s, "utf8"); }
function ensureImport(src, impLine){
  if (src.includes(impLine)) return src;
  const lines = src.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].startsWith("import ")) i++;
  lines.splice(i, 0, impLine);
  return lines.join("\n");
}

function replaceAll(src, pairs){
  let out = src;
  for (const [a,b] of pairs){
    out = out.replace(a,b);
  }
  return out;
}

function patchBuyNow(src){
  const re = /async\s+function\s+buyNow\s*\([\s\S]*?\)\s*\{[\s\S]*?\}\s*\n/;
  if (!re.test(src)) return src; // nothing
  const replacement = `async function buyNow(){try{const attrs=await prepareDesignAttributes();const potPrice=selectedPotVariant?.price?num(selectedPotVariant.price):firstVariantPrice(pots[selectedPotIndex]);const plantPrice=productMin(plants[selectedPlantIndex]);const basePrice=Math.max(1,Math.round((potPrice+plantPrice)*quantity));const dp=await createDesignProductSafe({title:\`DOBO \${plants[selectedPlantIndex]?.title||"Planta"} + \${pots[selectedPotIndex]?.title||"Maceta"}\`,previewUrl:attrs.find(a=>a.key==="__DesignPreview")?.value||attrs.find(a=>a.key==="_DesignPreview")?.value||"",price:String(basePrice),color:selectedColor||"Único",size:activeSize||"Único",designId:attrs.find(a=>a.key==="__DesignId")?.value||attrs.find(a=>a.key==="_DesignId")?.value||\`dobo-\${Date.now()}\`,plantTitle:plants[selectedPlantIndex]?.title||"Planta",potTitle:pots[selectedPotIndex]?.title||"Maceta"});const accIds=getAccessoryVariantIds();const shop=getShopDomain();const main=toNumericId(dp?.variantId||selectedVariant?.id);if(!shop){alert("No se detectó el dominio de Shopify");return;}if(!main){alert("Variante inválida");return;}postCart(shop,main,quantity,attrs,accIds,"/checkout");}catch(e){console.warn("GraphQL falló; usando fallback al variante seleccionado:",e);const attrs=await prepareDesignAttributes();const accIds=getAccessoryVariantIds();const shop=getShopDomain();const main=toNumericId(selectedVariant?.id);if(!shop){alert("No se detectó el dominio de Shopify");return;}if(!main){alert("Selecciona una maceta válida");return;}postCart(shop,main,quantity,attrs,accIds,"/checkout");}}\n`;
  return src.replace(re, replacement);
}

function patchHtml2Canvas(src){
  const re = /html2canvas\(\s*el\s*,\s*\{([\s\S]*?)\}\s*\)/m;
  if (!re.test(src)) return src;
  return src.replace(re, (m, inner)=> {
    if (inner.includes("windowWidth")) return m;
    const add = inner.trim().endsWith(",") ? inner + "\n  windowWidth: el.scrollWidth,\n  windowHeight: el.scrollHeight\n" : inner + ",\n  windowWidth: el.scrollWidth,\n  windowHeight: el.scrollHeight\n";
    return m.replace(inner, add);
  });
}

function patchHomePageFile(src){
  let out = src;
  // imports
  out = ensureImport(out, `import { getShopDomain, toNumericId, createDesignProductSafe } from "@/lib/checkoutHelpers";`);
  // SHOP_DOMAIN -> getShopDomain()
  out = out.replace(/\bSHOP_DOMAIN\b/g, "getShopDomain()");
  // postCart second arg: wrap candidate ids with toNumericId when obvious patterns appear
  out = out.replace(/postCart\(\s*getShopDomain\(\)\s*,\s*([a-zA-Z0-9_.?]+)\s*,/g, (m, id)=> m.replace(id, `toNumericId(${id})`));
  // Specific known variant variable names (safe id wrapper)
  out = out.replace(/\bvariantId\b/g, "toNumericId(variantId)");
  out = patchBuyNow(out);
  out = patchHtml2Canvas(out);
  return out;
}

function patchAppFile(src){
  return ensureImport(src, `import "@/lib/canvasWillReadFrequently";`);
}

function collectCandidates(){
  const out = [];
  const exts = [".js",".jsx",".ts",".tsx"];
  function walk(dir){
    const entries = fs.readdirSync(dir, { withFileTypes:true });
    for (const e of entries){
      if (e.name === ".next") continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()){ walk(p); continue; }
      if (!exts.includes(path.extname(e.name))) continue;
      if (/HomePage\.(jsx|tsx)$/i.test(e.name)) out.push(p);
      if (/index\.(jsx?|tsx?)$/i.test(e.name) && p.includes(path.sep + "pages" + path.sep)) out.push(p);
    }
  }
  walk(ROOT);
  return out;
}

(function main(){
  // install libs
  const libSrcDir = path.join(__dirname, "..", "lib");
  fs.mkdirSync(path.join(ROOT,"lib"), { recursive:true });
  fs.copyFileSync(path.join(libSrcDir,"canvasWillReadFrequently.js"), path.join(ROOT,"lib","canvasWillReadFrequently.js"));
  fs.copyFileSync(path.join(libSrcDir,"checkoutHelpers.js"), path.join(ROOT,"lib","checkoutHelpers.js"));

  // app import
  const appFiles = ["pages/_app.js","pages/_app.jsx","pages/_app.tsx"];
  let appPatched = false;
  for (const f of appFiles){
    const abs = r(f);
    const s = readIf(abs);
    if (!s) continue;
    const o = patchAppFile(s);
    if (o !== s){ write(abs, o); console.log("Patched:", f); appPatched = true; }
  }
  if (!appPatched){
    write(r("pages/_app.js"), `import "@/lib/canvasWillReadFrequently";\nexport default function App({Component,pageProps}){return <Component {...pageProps}/>;}`);
    console.log("Created: pages/_app.js");
  }

  // patch candidates
  const files = collectCandidates();
  if (files.length === 0){
    console.warn("⚠️ No se encontraron HomePage.jsx/tsx ni pages/index.*. Ajusta el script si tienes otra ruta.");
  } else {
    for (const f of files){
      const s = readIf(f);
      if (!s) continue;
      const o = patchHomePageFile(s);
      if (o !== s){ write(f, o); console.log("Patched:", path.relative(ROOT, f)); }
    }
  }

  console.log("\\n✅ Listo. Vuelve a compilar.");
})();
