const { execSync } = require("node:child_process");
function run(cmd) { console.log(">", cmd); execSync(cmd, { stdio: "inherit" }); }
try {
  run("node scripts/fix-tdz-default-params.mjs components/CustomizationOverlay.impl.js");
} catch {}
try {
  run("node -e "process.exit(0)" && npm run --silent __ensure-babel-deps");
} catch {}
try {
  run("node scripts/fix-tdz-reorder-top-level.mjs components/CustomizationOverlay.impl.js");
} catch {}
try {
  run("node scripts/fix-tdz-predeclare-symbol.mjs components/CustomizationOverlay.impl.js S");
} catch {}
