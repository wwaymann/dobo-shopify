// Uses Babel to hoist default parameters that reference target identifiers into the function body.
// Usage: node scripts/fix-tdz-default-params-advanced.mjs <file> S [OtherNames...]
import fs from "node:fs";
import path from "node:path";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";

const [file, ...targets] = process.argv.slice(2);
if (!file || targets.length === 0) {
  console.error("Usage: node scripts/fix-tdz-default-params-advanced.mjs <file> <Name1> [Name2 ...]");
  process.exit(1);
}
const abs = path.resolve(file);
const src = fs.readFileSync(abs, "utf8");

function rhsReferencesTarget(rhs) {
  let found = false;
  traverse.default(rhs, {
    noScope: true,
    Identifier(p) { if (targets.includes(p.node.name)) { found = true; p.stop(); } }
  });
  return found;
}

const ast = parser.parse(src, {
  sourceType: "module",
  plugins: ["jsx", "classProperties", "objectRestSpread", "topLevelAwait", "optionalChaining", "nullishCoalescingOperator"]
});

let changed = false;

function transformFunction(path) {
  const node = path.node;
  const isArrow = t.isArrowFunctionExpression(node);
  // Ensure a block body to inject statements
  if (isArrow && !t.isBlockStatement(node.body)) {
    node.body = t.blockStatement([t.returnStatement(node.body)]);
  }
  const body = node.body;
  if (!t.isBlockStatement(body)) return; // safety
  const assigns = [];
  node.params = node.params.map((param, idx) => {
    if (t.isAssignmentPattern(param) && t.isIdentifier(param.left) && rhsReferencesTarget(param.right)) {
      const id = param.left;
      const rhs = param.right;
      assigns.push(t.ifStatement(
        t.binaryExpression("===", id, t.identifier("undefined")),
        t.expressionStatement(t.assignmentExpression("=", t.cloneNode(id), rhs))
      ));
      changed = true;
      return id; // remove default from param
    }
    return param;
  });
  if (assigns.length) body.body.unshift(...assigns);
}

traverse.default(ast, {
  FunctionDeclaration: transformFunction,
  FunctionExpression: transformFunction,
  ArrowFunctionExpression: transformFunction,
});

if (changed) {
  fs.writeFileSync(abs + ".bak_adv", src, "utf8");
  const out = generate.default(ast, { retainLines: true }).code;
  fs.writeFileSync(abs, out, "utf8");
  console.log("✓ Advanced default-params fix applied in", file, "for targets:", targets.join(", "));
} else {
  console.log("• No matching default-params referencing targets found in", file);
}
