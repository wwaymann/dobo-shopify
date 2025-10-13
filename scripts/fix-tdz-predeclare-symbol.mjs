// scripts/fix-tdz-predeclare-symbol.mjs
import fs from "node:fs";
import path from "node:path";

const [file, ...names] = process.argv.slice(2);
if (!file || names.length === 0) {
  console.error("Usage: node scripts/fix-tdz-predeclare-symbol.mjs <file> <Name1> [Name2 ...]");
  process.exit(1);
}
const abs = path.resolve(file);
const src = fs.readFileSync(abs, "utf8");
let out = src;
let header = "";

for (const name of names) {
  const declRegex = new RegExp(`^(\\s*)(const|let)\\s+${name}\\s*=`,`m`);
  const hasLetTop = new RegExp(`(^|\n)\s*let\s+${name}\s*;`).test(out);
  if (!hasLetTop) header += `let ${name};\n`;
  if (declRegex.test(out)) out = out.replace(declRegex, (m, sp) => `${sp}${name} =`);
}

const lines = out.split(/\r?\n/);
let insertAt = 0;
while (insertAt < lines.length) {
  const l = lines[insertAt].trim();
  if (l.startsWith("'use client'") || l.startsWith('"use client"') || l.startsWith("'use strict'") || l.startsWith('"use strict"') || l.startsWith("import ")) {
    insertAt++;
    continue;
  }
  break;
}
if (header) lines.splice(insertAt, 0, header.strip());
const final = lines.join("\n");

if (final !== src) {
  fs.writeFileSync(abs + ".bak3", src, "utf8");
  fs.writeFileSync(abs, final, "utf-8");
  console.log(`✓ Predeclared [${names.join(", ")}] and rewired top-level const/let in ${file}`);
} else {
  console.log("• No changes needed for", file);
}
