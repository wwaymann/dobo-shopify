DOBO Hotfix v6 (lazy proxy)

Este patch evita el error "Cannot access 'S' before initialization" causado por un ciclo/TDZ al importar "@/lib/designStore" desde la página.

Qué cambia:
- "features/lib/designStore.js" ahora es un **proxy perezoso**: exporta funciones async que internamente hacen `import("@/lib/designStore")` en runtime.
- Mantiene los **nombres de exportación** (exportPreviewDataURL, exportLayerAllPNG, exportOnly, etc.), así NO tienes que modificar `HomePage.jsx`.
- Se conserva el wrapper dinámico del Overlay y los alias `@/*`.

Cómo aplicar:
1) Copia el contenido de este ZIP en la raíz de tu repo (acepta sobrescribir).
2) Asegúrate de tener tu overlay grande en components/CustomizationOverlay.impl.js (el wrapper lo carga dinámicamente).
3) Build/deploy.

Con esto, cualquier `import { ... } from "../lib/designStore"` que haga `HomePage.jsx` se resuelve hacia el proxy lazy en `features/lib/designStore.js`, que ya **no** causa evaluación temprana del módulo real ni ciclos.
