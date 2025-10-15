// scripts/fix-tdz-default-params.mjs
import fs from "node:fs";
import path from "node:path";
const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("Usage: node scripts/fix-tdz-default-params.mjs <path/to/file1> [file2 ...]");
  process.exit(1);
}
function transformDefaultParams(code) {
  const paramWithDefault = /([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([^,\)\r\n]+)/g;
  function patchParams(paramsSrc) {
    const assigns = [];
    let clean = paramsSrc;
    let m;
    while ((m = paramWithDefault.exec(paramsSrc))) {
      const [full, name, expr] = m;
      assigns.push([name, expr.trim()]);
    }
    clean = clean.replace(paramWithDefault, "$1");
    return { clean, assigns };
  }
  function injectInBody(bodySrc, assigns) {
    if (!assigns.length) return bodySrc;
    const lines = assigns.map(([n, e]) => `if (${n} === undefined) ${n} = ${e};`);
    return bodySrc.replace(/^\s*\{/, (m) => "{\n" + lines.join("\n") + "\n");
  }
  let out = code;
  out = out.replace(/function\s+([A-Za-z0-9_$]+)\s*\(([^)]*)\)\s*(\{[^]*?\})/g, (m, name, params, body) => {
    const { clean, assigns } = patchParams(params);
    const body2 = injectInBody(body, assigns);
    return `function ${name}(${clean}) ${body2}`;
  });
  out = out.replace(/(\bconst\b|\blet\b|\bvar\b)\s+([A-Za-z0-9_$]+)\s*=\s*\(\s*([^)]*)\s*\)\s*=>\s*(\{[^]*?\})/g, (m, kind, name, params, body) => {
    const { clean, assigns } = patchParams(params);
    const body2 = injectInBody(body, assigns);
    return `${kind} ${name} = (${clean}) => ${body2}`;
  });
  out = out.replace(/(\bconst\b|\blet\b|\bvar\b)\s+([A-Za-z0-9_$]+)\s*=\s*\(\s*([^)]*)\s*\)\s*=>\s*([^{}\r\n;]+);?/g, (m, kind, name, params, expr) => {
    const { clean, assigns } = patchParams(params);
    if (!assigns.length) return m;
    const lines = assigns.map(([n, e]) => `if (${n} === undefined) ${n} = ${e};`).join("\n");
    return `${kind} ${name} = (${clean}) => {\n${lines}\n  return ${expr};\n}`;
  });
  return out;
}
for (const file of targets) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) { console.error("File not found:", abs); process.exitCode = 2; continue; }
  const src = fs.readFileSync(abs, "utf8");
  const out = transformDefaultParams(src);
  if (out !== src) {
    const backup = abs + ".bak";
    fs.writeFileSync(backup, src, "utf8");
    fs.writeFileSync(abs, out, "utf8");
    console.log("✓ Patched:", file, "\n  Backup:", path.basename(backup));
  } else {
    console.log("• No default params found to patch in:", file);
  }
}
