DOBO Hotfix v5 (patch)

Qué incluye:
1) jsconfig.json  -> Alias "@/*" para rutas absolutas.
2) components/CustomizationOverlay.js -> Wrapper client-only con import dinámico.
3) features/components/CustomizationOverlay.js -> Shim para "../components/CustomizationOverlay".
4) features/lib/designStore.js -> Shim para "../lib/designStore".
5) pages/index.js -> Passthrough a "../features/home/HomePage".

Cómo aplicar:
1) Copia TODO el contenido de este ZIP en la raíz de tu proyecto (acepta sobrescribir).
2) Renombra tu overlay grande a: components/CustomizationOverlay.impl.js
   (si hoy está en components/CustomizationOverlay.js).
3) Ejecuta build. Los shims mantendrán funcionando tus imports relativos existentes.

