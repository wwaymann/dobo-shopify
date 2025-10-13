DOBO Hotfix v10 — prebuild automático (Vercel friendly)

Este paquete añade:
- Wrapper del Overlay + shims + proxy
- 3 codemods anti-TDZ
- **scripts/prebuild-tdz.cjs** y **package.additions.json** para que Vercel ejecute los fixes ANTES del build.

Cómo aplicarlo:
1) Copia TODO en la raíz del repo.
2) Abre tu package.json y MERGEA el contenido de **package.additions.json**:
   - Añade bajo "scripts":  "prebuild": "node scripts/prebuild-tdz.cjs"
   - Añade bajo "devDependencies": @babel/parser, @babel/traverse, @babel/generator
3) Asegúrate que tu overlay grande vive en components/CustomizationOverlay.impl.js
4) Commit & deploy. Vercel ejecutará `prebuild` y aplicará los parches automáticamente.

Si el stack vuelve a señalar otro símbolo, cambia el último paso del prebuild para sumarlo:
  node scripts/fix-tdz-predeclare-symbol.mjs components/CustomizationOverlay.impl.js NUEVO_NOMBRE
