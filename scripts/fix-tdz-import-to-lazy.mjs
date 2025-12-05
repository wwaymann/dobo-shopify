// scripts/fix-tdz-import-to-lazy.mjs
// Usage: node scripts/fix-tdz-import-to-lazy.mjs <file> S [Other ...]
// For each target local name, finds ImportDeclaration specifiers and rewrites them to:
//   let S; import('module').then(m => { S = m.S /* or m.default if default */ })
// If the specifier had alias (import { S as X }), the local name is X.
import fs from "node:fs";
import path from "node:path";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";

const [file, ...targets] = process.argv.slice(2);
if (!file || targets.length === 0) {
  console.error("Usage: node scripts/fix-tdz-import-to-lazy.mjs <file> <Name1> [Name2 ...]");
  process.exit(1);
}
const abs = path.resolve(file);
const src = fs.readFileSync(abs, "utf8");
const ast = parser.parse(src, { sourceType: "module", plugins: ["jsx", "classProperties", "objectRestSpread", "topLevelAwait", "optionalChaining", "nullishCoalescingOperator"] });

// record additions per source
const lazyBySource = new Map(); // source -> Array<{ local, imported, isDefault }>
const toRemove = new Map(); // ImportDeclaration path -> Set(specifierIndex)

traverse.default(ast, {
  ImportDeclaration(path) {
    const specifiers = path.node.specifiers || [];
    specifiers.forEach((s, idx) => {
      if (t.isImportSpecifier(s)) {
        const local = s.local.name;
        if (targets.includes(local)) {
          const imported = t.isIdentifier(s.imported) ? s.imported.name : s.imported.value;
          if (!lazyBySource.has(path.node.source.value)) lazyBySource.set(path.node.source.value, []);
          lazyBySource.get(path.node.source.value).push({ local, imported, isDefault: false });
          if (!toRemove.has(path)) toRemove.set(path, new Set());
          toRemove.get(path).add(idx);
        }
      } else if (t.isImportDefaultSpecifier(s)) {
        const local = s.local.name;
        if (targets.includes(local)) {
          if (!lazyBySource.has(path.node.source.value)) lazyBySource.set(path.node.source.value, []);
          lazyBySource.get(path.node.source.value).push({ local, imported: "default", isDefault: true });
          if (!toRemove.has(path)) toRemove.set(path, new Set());
          toRemove.get(path).add(idx);
        }
      } else if (t.isImportNamespaceSpecifier(s)) {
        // skip namespaces
      }
    });
  }
});

// Apply removals
for (const [pathObj, idxSet] of toRemove.entries()) {
  const node = pathObj.node;
  node.specifiers = node.specifiers.filter((_, i) => !idxSet.has(i));
  if (node.specifiers.length === 0) {
    // keep bare import for side effects? If none of the targets were default-only, dropping is safe.
    // We'll re-add a dynamic import anyway. Remove to avoid duplicate.
    pathObj.remove();
  }
}

// Ensure top-level let declarations for locals
const decls = [];
for (const arr of lazyBySource.values()) {
  for (const spec of arr) {
    decls.push(spec.local);
  }
}
const prog = ast.program;
if (decls.length > 0) {
  // Insert after import block
  let insertIdx = 0;
  while (insertIdx < prog.body.length && (prog.body[insertIdx].type === "ImportDeclaration" || (prog.body[insertIdx].expression && (prog.body[insertIdx].expression.value === "use client" || prog.body[insertIdx].expression.value === "use strict")))) {
    insertIdx++;
  }
  const unique = Array.from(new Set(decls));
  const letDecl = t.variableDeclaration("let", unique.map(n => t.variableDeclarator(t.identifier(n), null)));
  prog.body.splice(insertIdx, 0, letDecl);
}

// Add dynamic imports
for (const [source, arr] of lazyBySource.entries()) {
  const thenBody = [];
  arr.forEach(spec => {
    const left = t.identifier(spec.local);
    const right = t.memberExpression(t.identifier("m"), t.identifier(spec.isDefault ? "default" : spec.imported));
    thenBody.push(t.expressionStatement(t.assignmentExpression("=", left, right)));
  });
  const thenFn = t.arrowFunctionExpression([t.identifier("m")], t.blockStatement(thenBody));
  const dyn = t.expressionStatement(t.callExpression(t.memberExpression(t.import(t.stringLiteral(source)), t.identifier("then")), [thenFn]));
  // Insert after declarations we added
  let insertIdx = 0;
  while (insertIdx < prog.body.length && (prog.body[insertIdx].type === "ImportDeclaration" || prog.body[insertIdx].type === "VariableDeclaration")) {
    insertIdx++;
  }
  prog.body.splice(insertIdx, 0, dyn);
}

const out = generate.default(ast, { retainLines: true }).code;
if (out !== src) {
  fs.writeFileSync(abs + ".bak4", src, "utf8");
  fs.writeFileSync(abs, out, "utf8");
  console.log(`✓ Rewrote imports for [${targets.join(", ")}] to lazy dynamic imports in ${file}`);
} else {
  console.log("• No matching imports found for targets", targets.join(", "));
}
