// bin/apply-patch.js
// Usage: node bin/apply-patch.js
const fs = require("fs");
const path = require("path");

const targets = [
  "features/home/HomePage.jsx",
  "features/home/HomePage.tsx",
  "pages/index.js",
  "pages/index.jsx",
  "pages/index.tsx",
];

function read(p) { try { return fs.readFileSync(p, "utf8"); } catch { return null; } }
function write(p, s) { fs.writeFileSync(p, s, "utf8"); }

function ensureImport(src, filePath) {
  const rel = filePath.startsWith("features/") ? "../../lib/checkoutHelpers" : "../lib/checkoutHelpers";
  if (src.includes("from \""+rel+"\"") || src.includes("from '"+rel+"'")) return src;
  const line = `import { getShopDomain, toNumericId } from "${rel}";`;
  const firstImportIdx = src.indexOf("import ");
  if (firstImportIdx !== -1) {
    const before = src.slice(0, firstImportIdx);
    const after = src.slice(firstImportIdx);
    // insert after last import block
    const importEnd = after.lastIndexOf("\nimport ");
    if (importEnd !== -1) {
      const idx = firstImportIdx + importEnd + "\nimport ".length - "import ".length;
      // simpler: put at top
      return line + "\n" + src;
    }
  }
  return line + "\n" + src;
}

function replaceShopDomain(src) {
  return src.replace(/\bSHOP_DOMAIN\b/g, "getShopDomain()");
}

function wrapVariantInToNumericId(src) {
  return src.replace(/postCart\(\s*getShopDomain\(\)\s*,\s*([^) ,]+)\s*,/g, (m, g1) => {
    if (g1.includes("toNumericId(")) return m;
    return m.replace(g1, `toNumericId(${g1})`);
  });
}

function patchFile(file) {
  const src = read(file);
  if (!src) return false;
  let out = src;
  out = ensureImport(out, file);
  out = replaceShopDomain(out);
  out = wrapVariantInToNumericId(out);
  if (out !== src) {
    write(file, out);
    console.log("Patched:", file);
    return true;
  } else {
    console.log("No changes for:", file);
    return true;
  }
}

(function main() {
  for (const t of targets) {
    if (fs.existsSync(t)) patchFile(t);
    else console.log("Skip (missing):", t);
  }
  const helperDest = path.join("lib", "checkoutHelpers.js");
  if (!fs.existsSync("lib")) fs.mkdirSync("lib");
  if (!fs.existsSync(helperDest)) {
    const helperSrc = path.join(__dirname, "..", "lib", "checkoutHelpers.js");
    fs.copyFileSync(helperSrc, helperDest);
    console.log("Added:", helperDest);
  } else {
    console.log("Found existing:", helperDest);
  }
  console.log("Done.");
})();
