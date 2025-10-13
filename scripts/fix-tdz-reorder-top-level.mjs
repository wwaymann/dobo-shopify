// scripts/fix-tdz-reorder-top-level.mjs
import fs from "node:fs";
import path from "node:path";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/fix-tdz-reorder-top-level.mjs <path/to/file.js>");
  process.exit(1);
}
const abs = path.resolve(file);
const src = fs.readFileSync(abs, "utf8");
const ast = parser.parse(src, {
  sourceType: "module",
  plugins: ["jsx", "classProperties", "objectRestSpread", "optionalChaining", "nullishCoalescingOperator", "topLevelAwait"]
});
const stmtPaths = [];
const declInfos = new Map();
traverse.default(ast, {
  enter(p) {
    if (p.parentPath && p.parentPath.isProgram() && p.node && !stmtPaths.includes(p)) {
      stmtPaths.push(p);
    }
  },
  VariableDeclaration(p) {
    if (!p.parentPath || !p.parentPath.isProgram()) return;
    for (const d of p.node.declarations) {
      if (d.id && d.id.type === "Identifier") {
        declInfos.set(d.id.name, { stmtPath: p });
      }
    }
  },
  ClassDeclaration(p) {
    if (!p.parentPath || !p.parentPath.isProgram()) return;
    if (p.node.id) {
      declInfos.set(p.node.id.name, { stmtPath: p });
    }
  }
});
const firstRef = new Map();
traverse.default(ast, {
  Identifier(p) {
    const name = p.node.name;
    if (!declInfos.has(name)) return;
    const parent = p.parent;
    if (
      (p.parentPath.isVariableDeclarator() && parent.id === p.node) ||
      (p.parentPath.isClassDeclaration() && parent.id === p.node) ||
      (p.parentPath.isFunctionDeclaration() && parent.id === p.node)
    ) return;
    let sp = p.parentPath;
    while (sp && !sp.isProgram()) sp = sp.parentPath;
    if (!sp) return;
    const idx = stmtPaths.indexOf(sp);
    const current = firstRef.get(name);
    if (!current || idx < current.index) firstRef.set(name, { stmtPath: sp, index: idx });
  }
});
function moveBefore(targetPath, toBeforePath) {
  targetPath.remove();
  toBeforePath.insertBefore(targetPath.node);
}
let moved = 0;
for (const [name, refInfo] of firstRef.entries()) {
  const decl = declInfos.get(name);
  if (!decl) continue;
  const declIdx = stmtPaths.indexOf(decl.stmtPath);
  if (declIdx > refInfo.index) {
    moveBefore(decl.stmtPath, refInfo.stmtPath);
    moved++;
  }
}
if (moved > 0) {
  fs.writeFileSync(abs + ".bak2", src, "utf8");
  const out = generate.default(ast, { retainLines: true }).code;
  fs.writeFileSync(abs, out, "utf8");
  console.log(`✓ Moved ${moved} top-level declarations before their first reference in ${file}`);
} else {
  console.log("• No top-level reordering needed in", file);
}
