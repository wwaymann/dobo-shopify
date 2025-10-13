const { execSync } = require("node:child_process");
function run(cmd) { console.log(">", cmd); try { execSync(cmd, { stdio: "inherit" }); } catch (e) { console.log("! ignore error:", cmd); } }
run("node scripts/fix-tdz-default-params.mjs components/CustomizationOverlay.impl.js");
run("npm run --silent __ensure-babel-deps || true");
run("node scripts/fix-tdz-reorder-top-level.mjs components/CustomizationOverlay.impl.js");
run("node scripts/fix-tdz-predeclare-symbol.mjs components/CustomizationOverlay.impl.js S");
run("node scripts/fix-tdz-import-to-lazy.mjs components/CustomizationOverlay.impl.js S");
