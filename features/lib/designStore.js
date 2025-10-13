// Lazy proxy shim to avoid TDZ/circular import issues with "@/lib/designStore".
async function mod() { return import("@/lib/designStore"); }
export async function exportPreviewDataURL(...args) { const m = await mod(); return m.exportPreviewDataURL(...args); }
export async function dataURLtoBase64Attachment(...args) { const m = await mod(); return m.dataURLtoBase64Attachment(...args); }
export async function loadLocalDesign(...args) { const m = await mod(); return m.loadLocalDesign(...args); }
export async function exportLayerAllPNG(...args) { const m = await mod(); return m.exportLayerAllPNG(...args); }
export async function exportOnly(...args) { const m = await mod(); return m.exportOnly(...args); }
export default async function __designStoreDefaultProxy(...args) { const m = await mod(); return (m.default ? m.default(...args) : undefined); }
