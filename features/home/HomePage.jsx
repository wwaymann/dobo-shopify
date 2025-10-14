// pages/index.js — DOBO full corrected version (TDZ/hydratation-safe)

import { useEffect, useState, useRef, useMemo } from "react";
import Head from "next/head";
import styles from "../../styles/home.module.css";
import dynamic from "next/dynamic";
import { getShopDomain } from "../../lib/shopDomain"; // o "../lib/shopDomain"
const SHOP_DOMAIN = getShopDomain();

// Overlay / Editor (Fabric.js, client-only)
const CustomizationOverlay = dynamic(() => import("../components/CustomizationOverlay"), { ssr: false });

/* =============================
 * Utils
 * ============================= */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function money(amount, currency = "CLP") {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency, maximumFractionDigits: 0 })
    .format(Number(amount || 0));
}
function num(v) {
  return Number(typeof v === "object" ? v?.amount : v || 0);
}
const firstVariantPrice = (p) => {
  const v = p?.variants?.[0]?.price;
  return v ? num(v) : num(p?.minPrice);
};
const productMin = (p) => num(p?.minPrice);

// Carga DIFERIDA de designStore para romper ciclos/TDZ
async function getDesignExports() {
  const mod = await import("@/lib/designStore");
  return {
    exportPreviewDataURL: mod.exportPreviewDataURL,
    dataURLtoBase64Attachment: mod.dataURLtoBase64Attachment,
    loadLocalDesign: mod.loadLocalDesign,
    exportLayerAllPNG: mod.exportLayerAllPNG,
    exportOnly: mod.exportOnly,
  };
}

// Escape para HTML del tooltip/iframe
const escapeHtml = (s) =>
  (s ? s.replace(/[&<>\"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])) : "");

const buildIframeHTML = (imgUrl, title, desc) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}body{margin:0;background:#fff;font-family:system-ui,sans-serif}
.wrap{padding:8px;display:flex;flex-direction:column;align-items:center;gap:8px}
img{max-width:100%;height:auto;display:block}
h4{margin:0;font-size:14px;font-weight:600;text-align:center}
p{margin:0;font-size:12px;line-height:1.35;text-align:center;color:#333}
</style></head><body><div class="wrap">
<img src="${escapeHtml(imgUrl || "")}" alt=""><h4>${escapeHtml(title || "")}</h4><p>${escapeHtml(desc || "")}</p>
</div></body></html>`;

function getPreviewRect() {
  if (typeof window === "undefined") return { w: 360, h: 360, centered: false };
  const m = window.innerWidth <= 768;
  const w = m ? Math.min(window.innerWidth - 24, 420) : 360;
  const h = m ? Math.min(Math.floor(window.innerHeight * 0.6), 520) : 360;
  return { w, h, centered: m };
}

function IframePreview(props) {
  const [rect, setRect] = useState({ w: 360, h: 360, centered: false });
  useEffect(() => { if (props.visible) setRect(getPreviewRect()); }, [props.visible]);
  if (!props.visible) return null;
  const base = {
    position: "fixed",
    borderRadius: 12,
    overflow: "hidden",
    background: "#fff",
    boxShadow: "0 12px 32px rgba(0,0,0,.24)",
    zIndex: 9999,
    pointerEvents: "none",
  };
  const style = rect.centered
    ? { ...base, left: "50%", bottom: 12, transform: "translateX(-50%)", width: rect.w, height: rect.h }
    : { ...base, left: props.x, top: props.y, width: rect.w, height: rect.h };
  return (
    <div style={style}>
      <iframe srcDoc={props.html} style={{ width: "100%", height: "100%", border: 0, pointerEvents: "none" }} />
    </div>
  );
}

function IndicatorDots({ count, current, onSelect, position = "bottom" }) {
  if (!count || count < 2) return null;
  return (
    <div className={`${styles.dots} ${position === "top" ? styles.dotsTop : styles.dotsBottom}`}>
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          className={`${styles.dot} ${i === current ? styles.dotActive : ""}`}
          aria-current={i === current ? "true" : "false"}
          onClick={() => onSelect(i)}
        />
      ))}
      <span className={styles.dotsLabel}>{current + 1}/{count}</span>
    </div>
  );
}

// Swipe genérico con pointer/touch/mouse y try/catch en capture
function makeSwipeEvents(swipeRef, handlers) {
  const begin = (x, y, id, el) => {
    swipeRef.current = { active: true, id, x, y };
    if (id != null && el?.setPointerCapture) { try { el.setPointerCapture(id); } catch {} }
  };
  const end = (ev, el) => {
    const id = swipeRef.current?.id;
    if (id != null && el?.releasePointerCapture) { try { el.releasePointerCapture(id); } catch {} }
    swipeRef.current = { active: false, id: null, x: 0, y: 0 };
  };
  const move = (x, y, ev, el) => {
    const s = swipeRef.current;
    if (!s?.active) return;
    const dx = x - s.x, dy = y - s.y;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      ev.preventDefault();
      if (Math.abs(dx) > 48) { dx > 0 ? handlers.prev() : handlers.next(); end(ev, el); }
    }
  };
  return {
    onPointerDown: (e) => begin(e.clientX, e.clientY, e.pointerId ?? null, e.currentTarget),
    onPointerMove: (e) => move(e.clientX, e.clientY, e, e.currentTarget),
    onPointerUp: (e) => end(e, e.currentTarget),
    onPointerCancel: (e) => end(e, e.currentTarget),
    onTouchStart: (e) => { const t = e.touches[0]; begin(t.clientX, t.clientY, null, e.currentTarget); },
    onTouchMove: (e) => { const t = e.touches[0]; move(t.clientX, t.clientY, e, e.currentTarget); },
    onTouchEnd: (e) => end(e, e.currentTarget),
    onTouchCancel: (e) => end(e, e.currentTarget),
    onMouseDown: (e) => begin(e.clientX, e.clientY, null, e.currentTarget),
    onMouseMove: (e) => move(e.clientX, e.clientY, e, e.currentTarget),
    onMouseUp: (e) => end(e, e.currentTarget),
  };
}

/* =============================
 * Helpers: upload, timeout, email
 * ============================= */
async function uploadDataUrl(dataUrl, filename = `file-${Date.now()}.png`) {
  try {
    const res = await fetch("/api/upload-design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, filename }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
    return j?.url || "";
  } catch (e) {
    console.error("uploadDataUrl error:", e);
    return "";
  }
}

async function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

async function sendEmailLayers() {
  try {
    const { exportPreviewDataURL, exportLayerAllPNG, exportOnly } = await getDesignExports();
    const preview = await exportPreviewDataURL().catch(() => null);
    const layerAll = await exportLayerAllPNG().catch(() => null);
    const layerTxt = await exportOnly("text").catch(() => null);
    const layerImg = await exportOnly("image").catch(() => null);

    const [previewUrl, allUrl, txtUrl, imgUrl] = await Promise.all([
      preview ? uploadDataUrl(preview, `preview-${Date.now()}.png`) : "",
      layerAll ? uploadDataUrl(layerAll, `layer-all-${Date.now()}.png`) : "",
      layerTxt ? uploadDataUrl(layerTxt, `layer-text-${Date.now()}.png`) : "",
      layerImg ? uploadDataUrl(layerImg, `layer-image-${Date.now()}.png`) : "",
    ]);

    const res = await fetch("/api/send-design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previewUrl, allUrl, txtUrl, imgUrl }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* =============================
 * Componente principal
 * ============================= */
export default function HomePage() {
  // Hidratación estable
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  // Shop domain (en efecto, no en tope del módulo)
  const [shopDomain, setShopDomain] = useState(process.env.NEXT_PUBLIC_SHOP_DOMAIN || "um7xus-0u.myshopify.com");
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const fromQS = qs.get("shopDomain");
      if (fromQS) return setShopDomain(fromQS);
      if (document.referrer) {
        const h = new URL(document.referrer).host;
        if (h) setShopDomain(h);
      }
    } catch {}
  }, []);

  // State principal
  const [selectedColor, setSelectedColor] = useState("Cemento");
  const [activeSize, setActiveSize] = useState("Mediano");
  const [plants, setPlants] = useState([]);
  const [pots, setPots] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [selectedPlantIndex, setSelectedPlantIndex] = useState(0);
  const [selectedPotIndex, setSelectedPotIndex] = useState(0);
  const [selectedPotVariant, setSelectedPotVariant] = useState(null);
  const [selectedAccessoryIndices, setSelectedAccessoryIndices] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [colorOptions, setColorOptions] = useState([]);
  const [editing, setEditing] = useState(false);
  const [accPreview, setAccPreview] = useState({ visible: false, x: 0, y: 0, html: "" });

  // Refs
  const zoomRef = useRef(0.75);
  const sceneWrapRef = useRef(null);
  const stageRef = useRef(null);
  const plantScrollRef = useRef(null);
  const potScrollRef = useRef(null);
  const plantSwipeRef = useRef({ active: false, id: null, x: 0, y: 0 });
  const potSwipeRef = useRef({ active: false, id: null, x: 0, y: 0 });
  const designMetaRef = useRef(null);
  const restoredOnceRef = useRef(false);
  const userPickedSizeRef = useRef(false);

  // Derivados
  const selectedProduct = pots[selectedPotIndex] || {};
  const selectedVariant = useMemo(() => {
    if (selectedPotVariant) return selectedPotVariant;
    const v0 = selectedProduct?.variants?.[0];
    return v0 || null;
  }, [selectedPotVariant, selectedProduct]);

  /* ---------- Eventos editor ---------- */
  useEffect(() => {
    const onFlag = (e) => setEditing(!!e.detail?.editing);
    window.addEventListener("dobo-editing", onFlag);
    return () => window.removeEventListener("dobo-editing", onFlag);
  }, []);

  useEffect(() => {
    const s = stageRef.current, c = sceneWrapRef.current;
    if (!s || !c) return;
    const ps = s.style.touchAction, pc = c.style.touchAction;
    s.style.touchAction = editing ? "none" : "pan-y";
    c.style.touchAction = editing ? "none" : "pan-y";
    return () => { s.style.touchAction = ps; c.style.touchAction = pc; };
  }, [editing]);

  // Set zoom var al montar
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.style.setProperty("--zoom", String(zoomRef.current));
  }, []);

  // Centrado horizontal del contenedor
  useEffect(() => {
    const shell = sceneWrapRef?.current;
    if (!shell) return;
    const center = () => {
      try {
        const content = shell.querySelector(".container");
        if (!content) return;
        const target = Math.max(0, (content.scrollWidth - shell.clientWidth) / 2);
        shell.scrollLeft = target;
      } catch {}
    };
    center();
    const onR = () => center();
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  /* ---------- Zoom con rueda ---------- */
  useEffect(() => {
    const container = sceneWrapRef.current, stage = stageRef.current;
    if (!container || !stage) return;
    zoomRef.current = zoomRef.current || 1;
    stage.style.setProperty("--zoom", String(zoomRef.current));
    const MIN = 0.5, MAX = 2.5;
    let target = zoomRef.current, raf = 0;
    const clamp = (v) => Math.min(MAX, Math.max(MIN, v));
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        stage.style.setProperty("--zoom", String(target));
        container.style.setProperty("--zoom", String(target));
      });
    };
    const onWheel = (e) => {
      if (!stage.contains(e.target)) return;
      e.preventDefault();
      const step = e.deltaY > 0 ? -0.08 : 0.08;
      zoomRef.current = clamp(zoomRef.current + step);
      target = zoomRef.current;
      schedule();
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* ---------- Fetch productos por tamaño ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sizeQ = encodeURIComponent(activeSize);
        const [rPots, rPlants, rAcc] = await Promise.all([
          fetch(`/api/products?size=${sizeQ}&type=maceta&first=60`, { cache: "no-store" }),
          fetch(`/api/products?size=${sizeQ}&type=planta&first=60`, { cache: "no-store" }),
          fetch(`/api/products?type=accesorio&first=60`, { cache: "no-store" }),
        ]);
        if (!rPots.ok) throw new Error(`pots HTTP ${rPots.status}`);
        if (!rPlants.ok) throw new Error(`plants HTTP ${rPlants.status}`);
        const dPots = await rPots.json();
        const dPlants = await rPlants.json();
        const dAcc = rAcc.ok ? await rAcc.json() : [];
        const norm = (list) =>
          (Array.isArray(list) ? list : list?.products || []).map((p) => ({
            ...p,
            description: p?.description || p?.descriptionHtml || p?.body_html || "",
            descriptionHtml: p?.descriptionHtml || "",
            tags: Array.isArray(p?.tags) ? p.tags : [],
            variants: Array.isArray(p?.variants) ? p.variants : [],
            image: p?.image?.src || p?.image || (Array.isArray(p?.images) && p.images[0]?.src) || "",
            minPrice: p?.minPrice || { amount: 0, currencyCode: "CLP" },
          }));

        if (cancelled) return;
        const potsSafe = norm(dPots);
        const plantsSafe = norm(dPlants);
        const accSafe = norm(dAcc);

        setPots(potsSafe);
        setPlants(plantsSafe);
        setAccessories(accSafe);

        setSelectedPotIndex((i) => Math.min(Math.max(i, 0), Math.max(potsSafe.length - 1, 0)));
        setSelectedPlantIndex((i) => Math.min(Math.max(i, 0), Math.max(plantsSafe.length - 1, 0)));
        userPickedSizeRef.current = false;
      } catch (err) {
        console.error("Error fetching products:", err);
        if (!cancelled) {
          setPlants([]);
          setPots([]);
          setAccessories([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeSize]);

  /* ---------- Aplicar selección deseada desde meta/query (una vez) ---------- */
  useEffect(() => {
    const applyDesiredSelection = () => {
      if (restoredOnceRef.current) return;
      if (!Array.isArray(pots) || !Array.isArray(plants)) return;
      if (pots.length === 0 && plants.length === 0) return;

      const meta = designMetaRef.current || {};
      const q = new URLSearchParams(window.location.search);

      const toStr = (v) => String(v || "").toLowerCase().trim();
      const gidToNum = (id) => {
        const s = String(id || "");
        return s.includes("gid://") ? s.split("/").pop() : s;
        };

      const wantSize  = (q.get("size")  || meta.size  || meta.tamano || meta.tamaño || "").toLowerCase();
      const wantPot   = (q.get("pot")   || q.get("potHandle")   || meta.potHandle   || meta.potTitle   || meta.potId   || "").toLowerCase();
      const wantPlant = (q.get("plant") || q.get("plantHandle") || meta.plantHandle || meta.plantTitle || meta.plantId || "").toLowerCase();

      const findIdx = (arr, key) => {
        if (!key) return -1;
        const k = toStr(key);
        const kNum = gidToNum(k);
        return arr.findIndex((p) => {
          const ids = [p?.id, gidToNum(p?.id), p?.handle, p?.title].map(toStr);
          return ids.includes(k) || ids.includes(toStr(kNum));
        });
      };

      let touched = false;
      if (wantSize) {
        if (wantSize.startsWith("p")) { setActiveSize("Pequeño"); touched = true; }
        else if (wantSize.startsWith("m")) { setActiveSize("Mediano"); touched = true; }
        else if (wantSize.startsWith("g")) { setActiveSize("Grande"); touched = true; }
      }
      const ip = findIdx(pots, wantPot);
      if (ip >= 0) { setSelectedPotIndex(ip); touched = true; }
      const il = findIdx(plants, wantPlant);
      if (il >= 0) { setSelectedPlantIndex(il); touched = true; }
      if (meta.color) { setSelectedColor(meta.color); touched = true; }
      if (touched) restoredOnceRef.current = true;
    };
    applyDesiredSelection();
  }, [pots, plants]);

  /* ---------- Colores ---------- */
  const COLOR_MAP = useMemo(() => ({
    negro:"#000000", blanco:"#ffffff", gris:"#808080", "gris claro":"#bfbfbf", "gris oscuro":"#4a4a4a", plomo:"#9ea2a2",
    plata:"#c0c0c0", dorado:"#d4af37", cobre:"#b87333",
    rojo:"#ff0000", burdeo:"#6d071a", vino:"#7b001c", rosado:"#ff7aa2", rosa:"#ff7aa2",
    naranjo:"#ff7a00", naranja:"#ff7a00", amarillo:"#ffd400",
    verde:"#00a65a", "verde oliva":"#6b8e23", oliva:"#6b8e23", menta:"#3eb489",
    azul:"#0066ff", celeste:"#4db8ff", turquesa:"#30d5c8",
    morado:"#7d3cff", lila:"#b57edc", lavanda:"#b497bd",
    café:"#6f4e37", marrón:"#6f4e37", cafe:"#6f4e37", chocolate:"#4e2a1e",
    beige:"#d9c6a5", crema:"#f5f0e6", hueso:"#f2efe6",
  }), []);
  const _stripAccents = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const _norm = (raw) => _stripAccents(String(raw||"").toLowerCase().trim())
    .replace(/\s+/g," ")
    .replace(/(claro|oscuro|mate|brillante|satinado|metalico|metalic|pastel)\b/g,"$1")
    .trim();
  const resolveColor = (opt) => {
    const raw = String((opt&&opt.hex) || opt || "").trim();
    if (/^#([0-9a-f]{3}){1,2}$/i.test(raw)) return raw;
    const key = _norm(raw);
    if (COLOR_MAP[key]) return COLOR_MAP[key];
    const parts = key.split(/[\/,\-]/).map((s)=>s.trim());
    for (const p of parts) if (COLOR_MAP[p]) return COLOR_MAP[p];
    return "#ccc";
  };

  /* ---------- Variantes de maceta → opciones de color ---------- */
  useEffect(() => {
    const pot = pots[selectedPotIndex];
    if (!pot) { setColorOptions([]); setSelectedPotVariant(null); return; }
    const valid = (pot.variants || []).filter((v) => !!v.image);
    const lower = (s) => (s ?? "").toString().trim().toLowerCase();
    const colors = [...new Set(valid.flatMap((v) => (v.selectedOptions || [])
      .filter((o) => lower(o.name) === "color").map((o) => o.value)))];
    setColorOptions(colors);
    const match = (v, c) => {
      const opts = v.selectedOptions || [];
      return c ? opts.some((o) => lower(o.name) === "color" && lower(o.value) === lower(c)) : true;
    };
    if (!(selectedColor && valid.some((v) => match(v, selectedColor)))) {
      const first = colors.find((c) => valid.some((v) => match(v, c)));
      if (first) setSelectedColor(first);
    }
    const chosen = valid.find((v) => match(v, selectedColor)) || valid[0] || null;
    setSelectedPotVariant(chosen || null);
  }, [pots, selectedPotIndex, selectedColor]);

  /* ---------- Totales ---------- */
  const totalNow = useMemo(() => {
    const pot = pots[selectedPotIndex];
    const plant = plants[selectedPlantIndex];
    const potPrice = selectedPotVariant?.price ? num(selectedPotVariant.price) : firstVariantPrice(pot);
    const plantPrice = productMin(plant);
    const accTotal = selectedAccessoryIndices.reduce((s, i) => {
      const a = accessories[i];
      const v = a?.variants?.[0]?.price;
      return s + (v ? num(v) : productMin(a));
    }, 0);
    return (potPrice + plantPrice + accTotal) * quantity;
  }, [pots, plants, selectedPotIndex, selectedPlantIndex, selectedAccessoryIndices, quantity, selectedPotVariant]);

  const totalBase = useMemo(() => {
    const pot = pots[selectedPotIndex];
    const plant = plants[selectedPlantIndex];
    const potCmp = selectedPotVariant?.compareAtPrice ? num(selectedPotVariant.compareAtPrice) :
                    selectedPotVariant?.price ? num(selectedPotVariant.price) : firstVariantPrice(pot);
    const plantCmp = productMin(plant);
    const accCmp = selectedAccessoryIndices.reduce((s, i) => {
      const a = accessories[i];
      const base = a?.variants?.[0]?.compareAtPrice ?? a?.variants?.[0]?.price ?? a?.minPrice;
      return s + num(base);
    }, 0);
    return (potCmp + plantCmp + accCmp) * quantity;
  }, [pots, plants, selectedPotIndex, selectedPlantIndex, selectedAccessoryIndices, quantity, selectedPotVariant]);

  /* ---------- Captura de preview del diseño ---------- */
  async function captureDesignPreview() {
    const el = stageRef?.current;
    if (!el) return null;
    const { default: html2canvas } = await import("html2canvas");
    const onclone = (doc) => {
      const st = doc.querySelector('[data-capture-stage="1"]') || doc.body;
      st.style.overflow = "visible"; st.style.clipPath = "none";
      const prune = (sel, keep) => {
        const tr = doc.querySelector(sel); if (!tr) return;
        Array.from(tr.children).forEach((node, i) => { if (i !== keep) node.remove(); });
        tr.style.transform = "none"; tr.style.width = "100%";
      };
      prune('[data-capture="pot-track"]', selectedPotIndex);
      prune('[data-capture="plant-track"]', selectedPlantIndex);
      ["[data-capture=\"pot-container\"]", "[data-capture=\"plant-container\"]"].forEach((sel) => {
        const c = doc.querySelector(sel);
        if (c) { c.style.overflow = "visible"; c.style.clipPath = "none"; }
      });
    };
    const canvas = await html2canvas(el, { backgroundColor: "#eeeaeaff", scale: 3, useCORS: true, onclone });
    return canvas.toDataURL("image/png");
  }

  /* ---------- Atributos para carrito/checkout ---------- */
  async function prepareDesignAttributes() {
    let previewUrl = "";
    try {
      const dataUrl = await captureDesignPreview();
      if (dataUrl) {
        const resp = await fetch("/api/upload-design", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl })
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json?.error || "Error al subir preview");
        previewUrl = json.url || "";
      }
    } catch {}
    const pot = pots[selectedPotIndex];
    const plant = plants[selectedPlantIndex];
    return [
      { key: "_DesignPreview", value: previewUrl },
      { key: "_DesignId", value: String(Date.now()) },
      { key: "_DesignPlant", value: plant?.id || "" },
      { key: "_DesignPot", value: pot?.id || "" },
      { key: "_DesignColor", value: selectedColor || "" },
      { key: "_DesignSize", value: activeSize || "" },
      { key: "_LinePriority", value: "0" },
    ];
  }

  /* ---------- Export PNG solo capa (Fabric) ---------- */
  async function exportDesignLayerPNG() {
    const api = window.doboDesignAPI;
    const c = api?.getCanvas?.();
    if (!c) return null;
    const objs = c.getObjects?.() || [];
    const vis = objs.map((o) => o.visible);
    objs.forEach((o) => { o.visible = true; });
    c.requestRenderAll?.();
    const dataURL = c.toDataURL({ format: "png", multiplier: 2, backgroundColor: "transparent" });
    objs.forEach((o, i) => (o.visible = vis[i]));
    c.requestRenderAll?.();
    return dataURL;
  }

  async function waitDesignerReady(timeout = 20000) {
    let api = null;
    let resolved = false;
    const onEvt = (e) => { api = (e && e.detail) || window.doboDesignAPI; resolved = true; };
    window.addEventListener("dobo:ready", onEvt, { once: true });
    const start = Date.now();
    while (Date.now() - start < timeout && !resolved) {
      const a = window.doboDesignAPI;
      const ok = a && (a.exportDesignSnapshot || a.exportSnapshot || a.exportJSON || a.toJSON || a.getState);
      if (ok) { api = a; break; }
      await new Promise((r) => setTimeout(r, 100));
    }
    window.removeEventListener("dobo:ready", onEvt);
    return api || null;
  }

  async function publishDesignForVariant(variantId) {
    try {
      const api = await waitDesignerReady(20000);
      const layerDataURL = await exportDesignLayerPNG();
      if (!api) return { ok: false, error: "designer-not-ready" };

      const { loadLocalDesign } = await getDesignExports();

      let snap = (
        api.exportDesignSnapshot?.() ??
        api.exportSnapshot?.() ??
        api.exportJSON?.() ??
        api.toJSON?.() ??
        api.getState?.()
      );
      if (!snap && typeof loadLocalDesign === "function") snap = loadLocalDesign();
      if (!snap) return { ok: false, error: "no-snapshot" };

      let previewDataURL = null;
      try { previewDataURL = await captureDesignPreview(); } catch {}
      if (!previewDataURL) {
        const canvas = api.getCanvas?.() || api.canvas || document.querySelector("canvas");
        try { previewDataURL = canvas?.toDataURL?.("image/png") || null; } catch {}
      }
      if (!previewDataURL) return { ok: false, error: "no-preview" };

      const meta = {
        potId: pots[selectedPotIndex]?.id || "",
        potTitle: pots[selectedPotIndex]?.title || "",
        potHandle: pots[selectedPotIndex]?.handle || "",
        plantId: plants[selectedPlantIndex]?.id || "",
        plantTitle: plants[selectedPlantIndex]?.title || "",
        plantHandle: plants[selectedPlantIndex]?.handle || "",
        color: selectedColor || "",
        size: activeSize || "",
      };

      const r = await fetch("/api/publish-by-variant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, previewDataURL, layerDataURL, design: snap, meta }),
      });
      const raw = await r.text();
      let j; try { j = JSON.parse(raw); } catch { j = { ok: false, error: raw }; }
      if (!r.ok || !j?.ok) {
        const msg = j?.error ? `${j.error}${j.stage ? " @" + j.stage : ""}` : `HTTP ${r.status}`;
        return { ok: false, error: msg };
      }
      return j;
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  /* ---------- Post a /cart/add de Shopify ---------- */
function postCart(shop, mainVariantId, qty, attrs, accessoryIds, returnTo) {
  const shopDomain = String(shop || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

  const asStr = (v) => String(v || "").trim();
  const isNum = (v) => /^\d+$/.test(asStr(v));
  const gidToNum = (id) => {
    const s = asStr(id);
    return s.includes("gid://") ? s.split("/").pop() : s;
  };
  const main = isNum(mainVariantId) ? asStr(mainVariantId) : gidToNum(mainVariantId);
  if (!isNum(main)) throw new Error("Variant principal inválido");
  const accs = (accessoryIds || [])
    .map((id) => (isNum(id) ? asStr(id) : gidToNum(id)))
    .filter(isNum);

  const form = document.createElement("form");
  form.method = "POST";
  form.action = `https://${shopDomain}/cart/add`;
  form.target = "_top";
  const add = (n, v) => {
    const i = document.createElement("input");
    i.type = "hidden";
    i.name = n;
    i.value = String(v);
    form.appendChild(i);
  };

  let line = 0;
  const getA = (name) => {
    const n = name.toLowerCase();
    return (attrs || []).find((a) => {
      const k = (a.key || "").toLowerCase();
      return k === n || k === `_${n}`; // acepta con y sin underscore
    })?.value || "";
  };

  const previewUrl = getA("DesignPreview");
  const designId   = getA("DesignId");
  const designPlant= getA("DesignPlant");
  const designPot  = getA("DesignPot");
  const designColor= getA("DesignColor");
  const designSize = getA("DesignSize");

  add(`items[${line}][id]`, main);
  add(`items[${line}][quantity]`, String(qty || 1));
  add(`items[${line}][properties][_LinePriority]`, "0");
  if (previewUrl) add(`items[${line}][properties][_DesignPreview]`, previewUrl);
  if (designId)   add(`items[${line}][properties][_DesignId]`, designId);
  if (designPlant)add(`items[${line}][properties][_DesignPlant]`, designPlant);
  if (designPot)  add(`items[${line}][properties][_DesignPot]`, designPot);
  if (designColor)add(`items[${line}][properties][_DesignColor]`, designColor);
  if (designSize) add(`items[${line}][properties][_DesignSize]`, designSize);
  line++;

  accs.forEach((id) => {
    add(`items[${line}][id]`, id);
    add(`items[${line}][quantity]`, "1");
    add(`items[${line}][properties][_Accessory]`, "true");
    add(`items[${line}][properties][_LinePriority]`, "1");
    line++;
  });

  if (returnTo) add("return_to", returnTo);
  document.body.appendChild(form);
  form.submit();
}


  const getAccessoryVariantIds = () =>
    selectedAccessoryIndices
      .map((i) => accessories[i]?.variants?.[0]?.id)
      .map((id) => {
        const s = String(id || "");
        return s.includes("gid://") ? s.split("/").pop() : s;
      })
      .filter((id) => /^\d+$/.test(id));

  /* ---------- Acciones ---------- */
  async function buildAndSaveDesignForCartCheckout() {
    const { designId, attributes } = await (async () => {
      // Prefer Fabric snapshot export si existe
      const api = window.doboDesignAPI;
      if (api?.getCanvas) {
        const { exportPreviewDataURL, exportLayerAllPNG, exportOnly } = await getDesignExports();
        const previewDataUrl = await exportPreviewDataURL();
        const layerAllDataUrl = await exportLayerAllPNG();
        const layerTextDataUrl = await exportOnly("text");
        const layerImageDataUrl = await exportOnly("image");
        const [previewUrl, layerAllUrl, layerTextUrl, layerImageUrl] = await Promise.all([
          previewDataUrl ? uploadDataUrl(previewDataUrl, `preview-${Date.now()}.png`) : "",
          layerAllDataUrl ? uploadDataUrl(layerAllDataUrl, `layer-all-${Date.now()}.png`) : "",
          layerTextDataUrl ? uploadDataUrl(layerTextDataUrl, `layer-text-${Date.now()}.png`) : "",
          layerImageDataUrl ? uploadDataUrl(layerImageDataUrl, `layer-image-${Date.now()}.png`) : "",
        ]);
        const id = `dobo-${Date.now()}`;
        return {
          designId: id,
          attributes: [
            { key: "DesignPreview", value: previewUrl || "" },
            { key: "DesignLayer", value: layerAllUrl || "" },
            { key: "dobo_layer_text_url", value: layerTextUrl || "" },
            { key: "dobo_layer_image_url", value: layerImageUrl || "" },
            { key: "DesignColor", value: selectedColor || "" },
            { key: "DesignSize", value: activeSize || "" },
            { key: "DesignId", value: id },
          ],
        };
      }
      // Fallback a captura DOM
      const attrs = await prepareDesignAttributes();
      return { designId: attrs.find((a) => a.key === "_DesignId")?.value || `dobo-${Date.now()}`, attributes: attrs };
    })();
    return { designId, attributes };
  }

async function addToCart() {
  try {
    let attrs;
    if (typeof buildAndSaveDesignForCartCheckout === "function") {
      const r = await buildAndSaveDesignForCartCheckout();
      attrs = r?.attributes || [];
    } else if (typeof prepareDesignAttributes === "function") {
      attrs = await prepareDesignAttributes();
    } else {
      attrs = [{ key: "_DesignId", value: `dobo-${Date.now()}` }];
    }

    const productHandle = selectedProduct?.handle;
    const variantId = selectedVariant?.id;
    if (!productHandle || !variantId) throw new Error("Selecciona una maceta válida");

    await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productHandle, variantId, quantity, attributes: attrs }),
    });
    alert("Producto añadido al carrito con diseño guardado.");
  } catch (err) {
    console.error("Error al guardar diseño o añadir al carrito:", err);
    alert("Ocurrió un problema al añadir tu diseño al carrito.");
  }
}


async function createDesignProductSafe(payload) {
  // Llama a tu /api/design-product y lanza errores legibles si hay userErrors o 4xx/5xx
  const res = await fetch("/api/design-product", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const rawText = await res.text();
  let json;
  try { json = JSON.parse(rawText); } catch { json = { ok: false, error: rawText || `HTTP ${res.status}` }; }

  if (!res.ok || !json?.variantId) {
    const detail = json?.error || (json?.userErrors && JSON.stringify(json.userErrors)) || `HTTP ${res.status}`;
    throw new Error(`shopify-graphql-error: ${detail}`);
  }
  return json; // { variantId, productId? ... }
}

  
async function buyNow() {
  try {
    // --- 1) Reunir los atributos del diseño (attrs) ---
    let attrs = null;

    if (typeof buildAndSaveDesignForCartCheckout === "function") {
      // Tu helper (si existe) ya devuelve { designId, attributes }
      const r = await buildAndSaveDesignForCartCheckout();
      attrs = r?.attributes || [];
    } else if (typeof prepareDesignAttributes === "function") {
      // Fallback: usa el DOM/html2canvas para generar preview y meta
      attrs = await prepareDesignAttributes();
    } else {
      // Último recurso: atributos mínimos para no romper el checkout
      const nowId = `dobo-${Date.now()}`;
      attrs = [
        { key: "_DesignId", value: nowId },
        { key: "_LinePriority", value: "0" },
      ];
    }

    // --- 2) Cálculo base del precio (igual que tenías) ---
    const potPrice = selectedVariant?.price
      ? Number(selectedVariant.price?.amount ?? selectedVariant.price)
      : Number(
          pots?.[selectedPotIndex]?.variants?.[0]?.price?.amount ??
          pots?.[selectedPotIndex]?.variants?.[0]?.price ??
          0
        );
    const plantPrice = Number(
      plants?.[selectedPlantIndex]?.minPrice?.amount ??
      plants?.[selectedPlantIndex]?.minPrice ??
      0
    );
    const basePrice = Number(((potPrice + plantPrice) * quantity).toFixed(2));

    // --- 3) Intentar crear “producto de diseño” (no bloquea) ---
    let dp = null;
    try {
      const resp = await fetch("/api/design-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `DOBO ${plants[selectedPlantIndex]?.title} + ${pots[selectedPotIndex]?.title}`,
          previewUrl: (attrs.find(a => (a.key || "").toLowerCase().includes("designpreview"))?.value) || "",
          price: basePrice,
          color: selectedColor || "Único",
          size: activeSize || "Único",
          designId: (attrs.find(a => (a.key || "").toLowerCase() === "_designid" || (a.key || "").toLowerCase() === "designid")?.value) || `dobo-${Date.now()}`,
          plantTitle: plants[selectedPlantIndex]?.title || "Planta",
          potTitle: pots[selectedPotIndex]?.title || "Maceta",
        }),
      });
      try { dp = await resp.json(); } catch {}
      if (!resp.ok || !dp?.variantId) {
        console.warn("GraphQL falló; usando fallback al variante seleccionado");
        dp = null;
      }
    } catch (e) {
      console.warn("design-product request error:", e);
      dp = null;
    }

    // --- 4) Preparar carrito/checkout ---
    const accIds = getAccessoryVariantIds ? getAccessoryVariantIds() : [];
    const shop = getShopDomain();

    // Si se pudo crear el “producto de diseño”, usar ese variantId
    if (dp?.variantId) {
      try {
        const apiReady = await (waitDesignerReady?.(12000) ?? Promise.resolve(null)).catch(() => null);
        if (apiReady && typeof publishDesignForVariant === "function") {
          await publishDesignForVariant(dp.variantId).catch(() => {});
        }
      } catch {}
      postCart(shop, dp.variantId, quantity, attrs, accIds, "/checkout");
      return;
    }

    // Fallback: usa la variante seleccionada en la UI
    const chosen =
      selectedVariant?.id ||
      pots?.[selectedPotIndex]?.variants?.[0]?.id ||
      null;
    if (!chosen) throw new Error("variant-missing");
    postCart(shop, chosen, quantity, attrs, accIds, "/checkout");
  } catch (e) {
    alert(`No se pudo iniciar el checkout: ${e?.message || e}`);
  }
}



  /* ---------- Handlers de click/mitades para carrusel ---------- */
  const CLICK_STEP_PX = 8;
  const potDownRef = useRef({ btn: null, x: 0, y: 0 });
  const plantDownRef = useRef({ btn: null, x: 0, y: 0 });
  const handlePointerDownCap = (e, ref) => {
    ref.current = {
      btn: (e.pointerType === "mouse" || e.pointerType === "pen") ? e.button : 0,
      x: e.clientX ?? 0,
      y: e.clientY ?? 0,
    };
  };
  const handlePointerUpCap = (e, ref, handlers) => {
    if (editing) return;
    const d = ref.current || { btn: null, x: 0, y: 0 };
    if ((e.pointerType === "mouse" || e.pointerType === "pen") && d.btn !== 0) return;
    const dx = Math.abs((e.clientX ?? 0) - d.x);
    const dy = Math.abs((e.clientY ?? 0) - d.y);
    if (dx > CLICK_STEP_PX || dy > CLICK_STEP_PX) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX ?? 0) - rect.left;
    (x > rect.width / 2 ? handlers.next : handlers.prev)();
  };

  const createHandlers = (items, setIndex) => ({
    prev: () => setIndex((p) => (p > 0 ? p - 1 : Math.max(items.length - 1, 0))),
    next: () => setIndex((p) => (p < items.length - 1 ? p + 1 : 0)),
  });
  const plantHandlers = createHandlers(plants, setSelectedPlantIndex);
  const potHandlers = createHandlers(pots, setSelectedPotIndex);
  const plantSwipeEvents = makeSwipeEvents(plantSwipeRef, plantHandlers);
  const potSwipeEvents = makeSwipeEvents(potSwipeRef, potHandlers);

  /* ---------- Cargar desde ?designUrl ---------- */
  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const designUrl = params.get("designUrl");
        if (!designUrl) return;

        const wait = async (ms = 20000) => {
          const t0 = Date.now();
          while (Date.now() - t0 < ms) {
            const a = window.doboDesignAPI;
            const ok = a && (a.importDesignSnapshot || a.loadDesignSnapshot || a.loadJSON || a.loadFromJSON);
            if (ok) return a;
            await new Promise((r) => setTimeout(r, 100));
          }
          return null;
        };

        const api = await wait();
        if (!api) return;
        api?.reset?.();

        const resp = await fetch(designUrl, { cache: "no-store" });
        if (!resp.ok) return;
        const payload = await resp.json();
        const snapshot = payload?.design || payload;
        designMetaRef.current = payload?.meta || payload?.doboMeta || snapshot?.meta || null;

        if (api.importDesignSnapshot) {
          await api.importDesignSnapshot(snapshot);
        } else if (api.loadDesignSnapshot) {
          await api.loadDesignSnapshot(snapshot);
        } else if (api.loadJSON) {
          await api.loadJSON(snapshot);
        } else if (api.loadFromJSON) {
          await new Promise((res) => api.loadFromJSON(snapshot, () => { api.requestRenderAll?.(); res(); }));
        }
      } catch (e) {
        console.error("load designUrl failed", e);
      }
    })();
  }, []);

  /* ---------- UI ---------- */
  const baseCode = selectedPotVariant?.price?.currencyCode || "CLP";

  return (
    <>
      <Head>
        <title>DOBO · Personaliza tu maceta</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Bootstrap por CDN (evita import CSS en SSR) */}
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
          rel="stylesheet"
          crossOrigin="anonymous"
        />
      </Head>

      <div className={`container mt-lg-3 mt-0 ${styles.container}`} style={{ paddingBottom: "150px" }}>
        <div className="row justify-content-center align-items-start gx-5 gy-4">
          <div className="col-lg-5 col-md-8 col-12 text-center">
            {/* Tamaño */}
            <div className="btn-group mb-3" role="group" aria-label="Tamaño">
              {["Pequeño", "Mediano", "Grande"].map((s) => (
                <button
                  key={s}
                  className={`btn btn-sm ${activeSize === s ? "btn-dark" : "btn-outline-secondary"}`}
                  onClick={() => { userPickedSizeRef.current = true; setActiveSize(s); }}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Escena */}
            <div
              className="position-relative"
              ref={sceneWrapRef}
              style={{
                width: "100%",
                maxWidth: "500px",
                aspectRatio: "500 / 650",
                backgroundImage: "url('/images/fondo-dobo.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                border: "3px dashed #6c757d",
                borderRadius: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                touchAction: "pan-y",
                userSelect: "none",
              }}
            >
              {/* Dots & flechas PLANTAS */}
              <IndicatorDots
                count={plants.length}
                current={selectedPlantIndex}
                onSelect={(i) => setSelectedPlantIndex(Math.max(0, Math.min(i, plants.length - 1)))}
                position="top"
              />
              <button
                className={`${styles.chev} ${styles.chevTopLeft}`}
                aria-label="Anterior"
                onClick={() => setSelectedPlantIndex((p) => (p > 0 ? p - 1 : Math.max(plants.length - 1, 0)))}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button
                className={`${styles.chev} ${styles.chevTopRight}`}
                aria-label="Siguiente"
                onClick={() => setSelectedPlantIndex((p) => (p < plants.length - 1 ? p + 1 : 0))}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg>
              </button>

              {/* Dots & flechas MACETAS */}
              <IndicatorDots
                count={pots.length}
                current={selectedPotIndex}
                onSelect={(i) => setSelectedPotIndex(Math.max(0, Math.min(i, pots.length - 1)))}
                position="bottom"
              />
              <button
                className={`${styles.chev} ${styles.chevBottomLeft}`}
                aria-label="Anterior"
                onClick={() => setSelectedPotIndex((p) => (p > 0 ? p - 1 : Math.max(pots.length - 1, 0)))}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button
                className={`${styles.chev} ${styles.chevBottomRight}`}
                aria-label="Siguiente"
                onClick={() => setSelectedPotIndex((p) => (p < pots.length - 1 ? p + 1 : 0))}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg>
              </button>

              {/* Nodo escalado con carruseles */}
              <div
                ref={stageRef}
                data-capture-stage="1"
                className="d-flex justify-content-center align-items-end"
                style={{
                  height: "100%",
                  "--zoom": 0.75,
                  transform: "scale(var(--zoom))",
                  transformOrigin: "50% 70%",
                  willChange: "transform",
                  backfaceVisibility: "hidden",
                  touchAction: "pan-y",
                  userSelect: "none",
                }}
              >
                {/* Macetas */}
                <div
                  className={styles.carouselContainer}
                  ref={potScrollRef}
                  data-capture="pot-container"
                  style={{ zIndex: 1, touchAction: "pan-y", userSelect: "none" }}
                  onPointerDownCapture={(e) => handlePointerDownCap(e, potDownRef)}
                  onPointerUpCapture={(e) => handlePointerUpCap(e, potDownRef, createHandlers(pots, setSelectedPotIndex))}
                  onAuxClick={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}
                  {...potSwipeEvents}
                >
                  <div className={styles.carouselTrack} data-capture="pot-track" style={{ transform: `translateX(-${selectedPotIndex * 100}%)` }}>
                    {pots.map((product, idx) => {
                      const isSel = idx === selectedPotIndex;
                      const vImg = isSel ? selectedPotVariant?.image || selectedPotVariant?.imageUrl || null : null;
                      const imageUrl = vImg || product.image;
                      return (
                        <div key={product.id || idx} className={styles.carouselItem}>
                          <img src={imageUrl} alt={product.title} className={styles.carouselImage} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Plantas */}
                <div
                  className={styles.carouselContainer}
                  ref={plantScrollRef}
                  data-capture="plant-container"
                  style={{ zIndex: 2, position: "absolute", bottom: "300px", height: "530px", left: "50%", transform: "translateX(-50%)", touchAction: "pan-y", userSelect: "none" }}
                  onPointerDownCapture={(e) => handlePointerDownCap(e, plantDownRef)}
                  onPointerUpCapture={(e) => handlePointerUpCap(e, plantDownRef, createHandlers(plants, setSelectedPlantIndex))}
                  onAuxClick={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}
                  {...plantSwipeEvents}
                >
                  <div className={styles.carouselTrack} data-capture="plant-track" style={{ transform: `translateX(-${selectedPlantIndex * 100}%)` }}>
                    {plants.map((product, idx) => (
                      <div key={product.id || idx} className={styles.carouselItem}>
                        <img src={product.image} alt={product.title} className={`${styles.carouselImage} ${styles.plantImageOverlay}`} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Dock menú DOBO */}
            <div id="dobo-menu-dock" className={styles.menuDock} />
          </div>

          {/* Overlay de edición */}
          <CustomizationOverlay mode="both" stageRef={stageRef} anchorRef={potScrollRef} containerRef={sceneWrapRef} docked={false} />

          {/* Panel derecho */}
          <div className="col-lg-5 col-md-8 col-12">
            {pots.length > 0 && plants.length > 0 && (
              <div className="text-center">
                <div className="d-flex justify-content-center align-items-baseline gap-3 mb-4" style={{ marginTop: 20 }}>
                  {totalBase > totalNow && (
                    <p style={{ marginTop: 8, fontSize: "1.2rem", color: "#6c757d" }}>
                      <span style={{ textDecoration: "line-through" }}>{money(totalBase, baseCode)}</span>
                    </p>
                  )}
                  <span style={{ fontWeight: "bold", fontSize: "3rem" }}>{money(totalNow, baseCode)}</span>
                </div>

                {/* Color */}
                {colorOptions.length > 0 && (
                  <div className="mb-4">
                    <h5>Color</h5>
                    <div className="d-flex justify-content-center gap-3 flex-wrap">
                      {colorOptions.map((color, index) => {
                        const bg = resolveColor(color);
                        const isWhite = bg.toLowerCase() === "#ffffff" || bg.toLowerCase() === "#fff";
                        const isSelected = selectedColor === color;
                        return (
                          <div
                            key={index}
                            onClick={() => setSelectedColor(color)}
                            title={color}
                            aria-label={color}
                            aria-selected={isSelected}
                            style={{
                              width: 40, height: 40, borderRadius: "50%",
                              backgroundColor: bg,
                              border: isSelected ? "3px solid #000" : (isWhite ? "1px solid #999" : "1px solid #ccc"),
                              boxShadow: isSelected ? "0 0 0 3px rgba(0,0,0,0.15) inset" : "none",
                              cursor: "pointer",
                              transition: "transform .12s ease",
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Accesorios */}
                {accessories && accessories.length > 0 && (
                  <div className="mb-4 mt-4">
                    <h5>Accesorios</h5>
                    <div className="d-flex justify-content-center gap-3 flex-wrap">
                      {accessories.map((product, index) => {
                        const img =
                          product?.image?.src || product?.image ||
                          (Array.isArray(product?.images) && product.images[0]?.src) ||
                          "/placeholder.png";
                        const title = product?.title || product?.name || `Accesorio ${index + 1}`;
                        const selected = selectedAccessoryIndices.includes(index);
                        return (
                          <div
                            key={product?.id || index}
                            onClick={(e) => {
                              setSelectedAccessoryIndices((prev) =>
                                prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
                              );
                              const cx = typeof e?.clientX === "number" ? e.clientX : 0;
                              const cy = typeof e?.clientY === "number" ? e.clientY : 0;
                              setAccPreview({
                                visible: true,
                                x: cx + 16,
                                y: cy + 16,
                                html: buildIframeHTML(img, title, product?.description || product?.body_html || ""),
                              });
                            }}
                            onMouseEnter={(e) => {
                              const cx = typeof e?.clientX === "number" ? e.clientX : 0;
                              const cy = typeof e?.clientY === "number" ? e.clientY : 0;
                              setAccPreview({
                                visible: true,
                                x: cx + 16,
                                y: cy + 16,
                                html: buildIframeHTML(img, title, product?.description || product?.body_html || ""),
                              });
                            }}
                            onMouseMove={(e) =>
                              setAccPreview((p) => (p.visible ? { ...p, x: e.clientX + 16, y: e.clientY + 16 } : p))
                            }
                            onMouseLeave={() => setAccPreview((p) => ({ ...p, visible: false }))}
                            aria-label={title}
                            style={{
                              border: selected ? "3px solid black" : "1px solid #ccc",
                              borderRadius: "12px",
                              padding: "6px",
                              cursor: "zoom-in",
                              width: "100px",
                              height: "100px",
                              overflow: "hidden",
                              transition: "transform 0.2s ease",
                            }}
                          >
                            <img src={img} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "6px" }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Cantidad + botones */}
                <div className="d-flex flex-column align-items-center mb-5">
                  <div className="mb-3 text-center">
                    <label className="form-label d-block">Cantidad</label>
                    <div className="input-group justify-content-center" style={{ maxWidth: 200, margin: "0 auto" }}>
                      <button className="btn btn-outline-secondary" onClick={() => setQuantity((p) => Math.max(1, p - 1))}>-</button>
                      <input
                        type="number"
                        className="form-control text-center"
                        value={quantity}
                        min="1"
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          if (isNaN(n) || n < 1) setQuantity(1);
                          else if (n > 1000) setQuantity(1000);
                          else setQuantity(n);
                        }}
                      />
                      <button className="btn btn-outline-secondary" onClick={() => setQuantity((p) => Math.min(1000, p + 1))}>+</button>
                    </div>

                    <div className="d-flex gap-3 mt-3">
                      <button className="btn btn-outline-dark px-4 py-2" onClick={addToCart}>Añadir al carro</button>
                      <button className="btn btn-dark px-4 py-2" onClick={buyNow}>Comprar ahora</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Descripciones */}
            <div className="text-start px-3 mb-4" style={{ maxWidth: 500, margin: "0 auto" }}>
              <h6><strong>Planta</strong></h6>
              {(() => {
                const p = plants[selectedPlantIndex];
                const html = p?.descriptionHtml;
                const d = p?.description;
                return html ? (
                  <div style={{ fontSize: "1.2rem" }} dangerouslySetInnerHTML={{ __html: html }} />
                ) : (
                  <p style={{ fontSize: "1.2rem" }}>{d || "Descripción no disponible."}</p>
                );
              })()}

              <h6 className="mt-3"><strong>Maceta</strong></h6>
              {(() => {
                const p = pots[selectedPotIndex];
                const html = p?.descriptionHtml;
                const d = p?.description;
                return html ? (
                  <div style={{ fontSize: "1.2rem" }} dangerouslySetInnerHTML={{ __html: html }} />
                ) : (
                  <p style={{ fontSize: "1.2rem" }}>{d || "Descripción no disponible."}</p>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Preview flotante accesorios */}
        <IframePreview
          visible={accPreview.visible}
          x={accPreview.x}
          y={accPreview.y}
          html={accPreview.html}
        />

        <style jsx>{`
          .pot-carousel--locked {
            pointer-events: none;
            user-select: none;
            -webkit-user-drag: none;
            touch-action: none;
            overflow: hidden !important;
            scrollbar-width: none;
          }
          .pot-carousel--locked::-webkit-scrollbar { display: none; }
        `}</style>
      </div>
    </>
  );
}
