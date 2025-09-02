// pages/index.js
import { useEffect, useState, useRef } from "react";
import styles from "../styles/home.module.css";
import "bootstrap/dist/css/bootstrap.min.css";
import dynamic from "next/dynamic";
import 'bootstrap/dist/css/bootstrap.min.css';

// --- helpers: formato de precio ---
const money = (amount, currency = 'CLP') =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));


// --- [Hover Zoom IFRAME helpers] ---
const escapeHtml = (s) =>
  s && s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])) || "";

const buildIframeHTML = (imgUrl, title, desc) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box} body{margin:0;background:#fff;font-family:system-ui,sans-serif}
  .wrap{padding:8px;display:flex;flex-direction:column;align-items:center;gap:8px}
  img{max-width:100%;height:auto;display:block}
  h4{margin:0;font-size:14px;font-weight:600;text-align:center}
  p{margin:0;font-size:12px;line-height:1.35;text-align:center;color:#333}
</style></head>
<body><div class="wrap">
  <img src="${escapeHtml(imgUrl)}" alt="">
  <h4>${escapeHtml(title||"")}</h4>
  <p>${escapeHtml(desc||"")}</p>
</div></body></html>`;

function getPreviewRect(){
  if (typeof window === "undefined") return { w: 360, h: 360, centered: false };
  const isMobile = window.innerWidth <= 768;
  const w = isMobile ? Math.min(window.innerWidth - 24, 420) : 360;
  const h = isMobile ? Math.min(Math.floor(window.innerHeight * 0.6), 520) : 360;
  return { w, h, centered: isMobile };
}

function IframePreview(props){
  if (!props.visible) return null;
  const dims = getPreviewRect();
  const base = {
    position: 'fixed',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#fff',
    boxShadow: '0 12px 32px rgba(0,0,0,.24)',
    zIndex: 9999,
    pointerEvents: 'none'
  };
  const style = dims.centered
    ? { ...base, left: '50%', bottom: 12, transform: 'translateX(-50%)', width: dims.w, height: dims.h }
    : { ...base, left: props.x, top: props.y, width: dims.w, height: dims.h };

  return (
    <div style={style}>
      <iframe
        srcDoc={props.html}
        style={{ width: '100%', height: '100%', border: 0, pointerEvents: 'none' }}
      />
    </div>
  );
}

// --- [/helpers] ---

const CustomizationOverlay = dynamic(
  () => import("../components/CustomizationOverlay"),
  { ssr: false }
);

// Dominio de tu tienda para enviar al carrito del Online Store
const SHOP_DOMAIN = "um7xus-0u.myshopify.com";

export default function Home() {
  const [plants, setPlants] = useState([]);
  const [pots, setPots] = useState([]);
  const [accessories, setAccessories] = useState([]);

  const [selectedPlantIndex, setSelectedPlantIndex] = useState(0);
  const [selectedPotIndex, setSelectedPotIndex] = useState(0);
  const [selectedPotVariant, setSelectedPotVariant] = useState(null);

  const [selectedAccessoryIndices, setSelectedAccessoryIndices] = useState([]);
  const [quantity, setQuantity] = useState(1);

  // Zoom de la escena
  const [zoom, setZoom] = useState(1);
  const sceneWrapRef = useRef(null);

  // refs (escena y carruseles)
  const stageRef = useRef(null);
  const plantScrollRef = useRef(null);
  const potScrollRef = useRef(null);

  
  // Estado de edición emitido por CustomizationOverlay
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const onFlag = (e) => setEditing(!!e.detail?.editing);
    window.addEventListener("dobo-editing", onFlag);
    return () => window.removeEventListener("dobo-editing", onFlag);
  }, []);

// total a mostrar
const [total, setTotal] = useState(0);

// si NO existen ya en tu archivo, añade estos:
const [selectedPlantVariant, setSelectedPlantVariant] = useState(null);
const [selectedAccessories, setSelectedAccessories] = useState([]); // array de accesorios elegidos

  
  // Congela por completo el carrusel de macetas al editar
  useEffect(() => {
    const el = potScrollRef.current;
    if (!el) return;

    const block = (e) => {
      if (!editing) return;
      e.preventDefault();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      e.stopPropagation();
    };

    const freezeScroll = () => {
      if (!editing) return;
      el.scrollLeft = freezeX;
      el.scrollTop = freezeY;
    };

    let restoreTab = () => {};
    let freezeX = el.scrollLeft;
    let freezeY = el.scrollTop;

    if (editing) {
      // Inhabilita foco y activación interna
      const focusables = el.querySelectorAll("a,button,[tabindex]");
      const saved = [];
      focusables.forEach((n) => {
        saved.push([n, n.getAttribute("tabindex"), n.hasAttribute("disabled")]);
        n.setAttribute("tabindex", "-1");
        if (n.tagName === "BUTTON") n.disabled = true;
        n.setAttribute("aria-disabled", "true");
      });
      restoreTab = () => {
        saved.forEach(([n, tab, wasDisabled]) => {
          if (tab === null) n.removeAttribute("tabindex");
          else n.setAttribute("tabindex", tab);
          n.removeAttribute("aria-disabled");
          if (n.tagName === "BUTTON") n.disabled = wasDisabled;
        });
      };

      try { el.inert = true; } catch {}

      el.classList.add("pot-carousel--locked");

      const optsPassiveFalse = { capture: true, passive: false };
      const optsCapture = { capture: true };

      const typesPF = ["wheel","touchstart","touchmove"];
      const typesCap = ["touchend","pointerdown","pointerup","click","dblclick","contextmenu","keydown","dragstart","mousedown","mousemove","mouseup"];

      typesPF.forEach((t) => el.addEventListener(t, block, optsPassiveFalse));
      typesCap.forEach((t) => el.addEventListener(t, block, optsCapture));
      el.addEventListener("scroll", freezeScroll, optsCapture);

      return () => {
        el.classList.remove("pot-carousel--locked");
        try { el.inert = false; } catch {}
        typesPF.forEach((t) => el.removeEventListener(t, block, optsPassiveFalse));
        typesCap.forEach((t) => el.removeEventListener(t, block, optsCapture));
        el.removeEventListener("scroll", freezeScroll, optsCapture);
        restoreTab();
      };
    } else {
      el.classList.remove("pot-carousel--locked");
      try { el.inert = false; } catch {}
    }
  }, [editing]);

  // Zoom con rueda solo sobre el stage. Sin Ctrl.
  useEffect(() => {
    const el = stageRef?.current || sceneWrapRef?.current;
    if (!el) return;
    const onWheel = (e) => {
      const stage = stageRef?.current || el;
      if (!stage || !stage.contains(e.target)) return;
      e.preventDefault();
      const dz = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(2.5, Math.max(0.8, +(z + dz).toFixed(2))));
    };
    el.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => el.removeEventListener("wheel", onWheel, { capture: true });
  }, []);

  // === Hover preview (ÚNICO) ===
  const [accPreview, setAccPreview] = useState({ visible:false, x:0, y:0, html:"" });

  function openAccPreview(e, acc){
    const img = acc && acc.image ? (acc.image.src || acc.image)
      : (acc && acc.images && acc.images[0] && acc.images[0].src ? acc.images[0].src : "");
    const title = acc && (acc.title || acc.name) ? (acc.title || acc.name) : "";
    const desc = acc ? (acc.description || acc.body_html || "") : "";
    const cx = (e && typeof e.clientX === "number") ? e.clientX : 0;
    const cy = (e && typeof e.clientY === "number") ? e.clientY : 0;
    setAccPreview({ visible:true, x:cx+16, y:cy+16, html: buildIframeHTML(img, title, desc) }); 
  }

  function handleAccEnter(e, acc){ openAccPreview(e, acc); }
  function handleAccMove(e){
    const isMobile = (typeof window !== "undefined") && window.innerWidth <= 768;
    if (isMobile) return;
    setAccPreview(p => p.visible ? { ...p, x: e.clientX + 16, y: e.clientY + 16 } : p);
  }
  function handleAccLeave(){ setAccPreview(p => ({ ...p, visible:false })); }
  function handleAccClick(e, acc){
    const isMobile = (typeof window !== "undefined") && window.innerWidth <= 768;
    if (isMobile){
      if (accPreview.visible) handleAccLeave();
      else openAccPreview(e, acc);
    } else {
      openAccPreview(e, acc);
    }
  }

  // color/tamaño visibles
  const [selectedColor, setSelectedColor] = useState(null);
  const [colorOptions, setColorOptions] = useState([]);
  const [selectedSize, setSelectedSize] = useState(null);
  const [sizeOptions, setSizeOptions] = useState([]);

  // carrito persistente
  const [cartId, setCartId] = useState(null);
  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem("cartId")
        : null;
    if (saved) setCartId(saved);
  }, []);
  useEffect(() => {
    if (cartId && typeof window !== "undefined") {
      window.localStorage.setItem("cartId", cartId);
    }
  }, [cartId]);

  // normalizador
  const normalize = (s) => (s ?? "").toString().trim().toLowerCase();

  // ¿variante con imagen propia para (color,size)?
  const hasVariantOwnImage = ({ pot, color, size }) => {
    if (!pot?.variants) return false;
    const n = (x) => (x ?? "").toString().trim().toLowerCase();
    const nColor = color ? n(color) : null;
    const nSize = size ? n(size) : null;

    return pot.variants.some((v) => {
      if (!v?.image && !v?.hasOwnImage) return false;
      const opts = v.selectedOptions || [];
      const matchColor = nColor
        ? opts.some((o) => n(o.name) === "color" && n(o.value) === nColor)
        : true;
      const matchSize = nSize
        ? opts.some(
            (o) =>
              (n(o.name) === "tamaño" || n(o.name) === "size") &&
              n(o.value) === nSize
          )
        : true;
      return matchColor && matchSize;
    });
  };
useEffect(() => {
  const pot  = Number(selectedPotVariant?.price?.amount || 0);
  const plant = Number(selectedPlantVariant?.price?.amount || 0);
  const acc   = Array.isArray(selectedAccessories)
    ? selectedAccessories.reduce((s, a) => s + Number(a?.price?.amount || 0), 0)
    : 0;

  setTotal(pot + plant + acc);
}, [selectedPotVariant, selectedPlantVariant, selectedAccessories]);

  // mapa de colores
  const colorMap = {
    Rojo: "#a14747",
    Azul: "#484f76",
    Verde: "#7ed27e",
    "Verde oliva profundo": "#556b2f",
    Negro: "#000000",
    Blanco: "#ffffff",
    Gris: "#999999",
    "Gris cemento": "#999999",
    Amarillo: "#f8db00",
    Beige: "#EAD8AB",
  };

useEffect(() => {
  async function fetchProducts() {
    try {
      const res = await fetch('/api/products', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const arr = Array.isArray(data) ? data : [];
      const safe = arr.map(p => ({
        ...p,
        tags: Array.isArray(p?.tags) ? p.tags : [],
        variants: Array.isArray(p?.variants) ? p.variants : [],
        image: p?.image || '',
        minPrice: p?.minPrice || { amount: 0, currencyCode: 'CLP' },
      }));

      const byTag = (t) =>
        safe.filter(p => p.tags.some(tag => String(tag).toLowerCase().includes(t)));

      let plantas = byTag('plantas');
      let macetas = byTag('macetas');
      let accesorios = byTag('accesorios');

      if ((plantas.length + macetas.length + accesorios.length) === 0 && safe.length > 0) {
        macetas = safe; plantas = []; accesorios = [];
      }

      setPlants(plantas);
      setPots(macetas);
      setAccessories(accesorios);

      if (macetas.length > 0) {
        const fv =
          (macetas[0].variants || []).find(v => v?.availableForSale) ||
          macetas[0].variants?.[0] ||
          null;
        setSelectedPotVariant(fv || null);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setPlants([]);
      setPots([]);
      setAccessories([]);
    }
  }
  fetchProducts();
}, []);




      // Normaliza campos usados más abajo
      const safe = arr.map((p) => ({
        ...p,
        tags: Array.isArray(p?.tags) ? p.tags : [],
        variants: Array.isArray(p?.variants) ? p.variants : [],
        image:
          p?.image?.src ||
          p?.image ||
          (Array.isArray(p?.images) && p.images[0]?.src) ||
          "",
      }));

      const byTag = (t) =>
  safe.filter((p) => p.tags.some((tag) => String(tag).toLowerCase().includes(t)));

let plantas = byTag("plantas");
let macetas = byTag("macetas");
let accesorios = byTag("accesorios");

// Fallback: si no hay tags, usa todo como "macetas"
if ((plantas.length + macetas.length + accesorios.length) === 0 && safe.length > 0) {
  macetas = safe;
  plantas = [];
  accesorios = [];
}

setPlants(plantas);
setPots(macetas);
setAccessories(accesorios);

if (macetas.length > 0) {
  const firstVariant =
    (macetas[0].variants || []).find((v) => v?.image) ||
    macetas[0].variants?.[0] ||
    null;
  setSelectedPotVariant(firstVariant);


    } catch (err) {
      console.error("Error fetching products:", err);
      setPlants([]);
      setPots([]);
      setAccessories([]);
    }
  }
  fetchProducts();
}, []);


  const createHandlers = (items, setIndex) => ({
    prev: () => setIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1)),
    next: () => setIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0)),
  });

  const plantHandlers = createHandlers(plants, setSelectedPlantIndex);
  const potHandlers = createHandlers(pots, setSelectedPotIndex);

  // Drag para carruseles (planta/maceta)
  const setupDrag = (ref, handlers) => {
    useEffect(() => {
      const el = ref.current;
      if (!el) return;

      let isDown = false;
      let startX;

      const handleMouseDown = (e) => {
        isDown = true;
        startX = e.clientX;
      };
      const handleMouseMove = (e) => {
        if (!isDown) return;
        const diff = e.clientX - startX;
        if (Math.abs(diff) > 50) {
          if (diff > 0) handlers.prev();
          else handlers.next();
          isDown = false;
        }
      };
      const handleMouseUp = () => {
        isDown = false;
      };

      el.addEventListener("mousedown", handleMouseDown);
      el.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        el.removeEventListener("mousedown", handleMouseDown);
        el.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }, [ref, handlers]);
  };

  setupDrag(plantScrollRef, plantHandlers);
  setupDrag(potScrollRef, potHandlers);

  // opciones color/size derivadas de variantes con imagen
  useEffect(() => {
    const pot = pots[selectedPotIndex];
    if (!pot) {
      setColorOptions([]);
      setSizeOptions([]);
      return;
    }
    const validVariants = (pot.variants || []).filter((v) => !!v.image);

    const potColors = [
      ...new Set(
        validVariants.flatMap((v) =>
          (v.selectedOptions || [])
            .filter((o) => o.name.toLowerCase() === "color")
            .map((o) => o.value)
        )
      ),
    ];
    const potSizes = [
      ...new Set(
        validVariants.flatMap((v) =>
          (v.selectedOptions || [])
            .filter(
              (o) =>
                o.name.toLowerCase() === "tamaño" ||
                o.name.toLowerCase() === "size"
            )
            .map((o) => o.value)
        )
      ),
    ];

    setColorOptions(potColors);
    setSizeOptions(potSizes);

    if (!selectedSize || !potSizes.includes(selectedSize)) {
      if (potSizes.length >= 2) setSelectedSize(potSizes[1]);
      else if (potSizes.length === 1) setSelectedSize(potSizes[0]);
      else setSelectedSize(null);
    }
  }, [pots, selectedPotIndex]);

  // color por defecto que tenga imagen con el tamaño actual
  useEffect(() => {
    const pot = pots[selectedPotIndex];
    if (!pot) return;
    if (
      selectedColor &&
      hasVariantOwnImage({ pot, color: selectedColor, size: selectedSize })
    ) {
      return;
    }
    const firstValidColor = colorOptions.find((c) =>
      hasVariantOwnImage({ pot, color: c, size: selectedSize })
    );
    if (firstValidColor) setSelectedColor(firstValidColor);
    else {
      const anyColorWithImage = colorOptions.find((c) =>
        hasVariantOwnImage({ pot, color: c, size: null })
      );
      if (anyColorWithImage) setSelectedColor(anyColorWithImage);
    }
  }, [pots, selectedPotIndex, colorOptions, selectedSize, selectedColor]);

  // selectedPotVariant segun color/size, priorizando la que tenga imagen
  useEffect(() => {
    const pot = pots[selectedPotIndex];
    if (!pot || !pot.variants) return;

    let match = (pot.variants || []).find((variant) => {
      if (!variant?.image) return false;
      const options = variant.selectedOptions || [];
      const colorMatch = selectedColor
        ? options.some(
            (o) => o.name.toLowerCase() === "color" && o.value === selectedColor
          )
        : true;
      const sizeMatch = selectedSize
        ? options.some(
            (o) =>
              (o.name.toLowerCase() === "tamaño" ||
                o.name.toLowerCase() === "size") &&
              o.value === selectedSize
          )
        : true;
      return colorMatch && sizeMatch;
    });

    if (!match) {
      match = (pot.variants || []).find((v) => !!v.image) || null;
    }
    setSelectedPotVariant(match);
  }, [pots, selectedPotIndex, selectedColor, selectedSize]);

  const toggleAccessory = (index) => {
    setSelectedAccessoryIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const getTotalPrice = () => {
    const pot = pots[selectedPotIndex];
    const plant = plants[selectedPlantIndex];
    const accessoryTotal = selectedAccessoryIndices.reduce((sum, i) => {
      const acc = accessories[i];
      return sum + parseFloat(acc?.price || 0);
    }, 0);
    return (
      parseFloat(selectedPotVariant?.price || pot?.price || 0) +
      parseFloat(plant?.price || 0) +
      accessoryTotal
    );
  };

  const getTotalComparePrice = () => {
    const pot = pots[selectedPotIndex];
    const plant = plants[selectedPlantIndex];
    const accessoryCompareTotal = selectedAccessoryIndices.reduce((sum, i) => {
      const acc = accessories[i];
      return sum + parseFloat(acc?.compareAtPrice || acc?.price || 0);
    }, 0);
    return (
      parseFloat(
        selectedPotVariant?.compareAtPrice ||
          selectedPotVariant?.price ||
          pot?.compareAtPrice ||
          pot?.price ||
          0
      ) +
      parseFloat(plant?.compareAtPrice || plant?.price || 0) +
      accessoryCompareTotal
    );
  };

  // Convierte GID de variante a ID numérico (para /cart/add)
  const gidToNumeric = (id) => {
    const s = String(id || "");
    return s.includes("gid://") ? s.split("/").pop() : s;
    };

  // ---------- CAPTURA Y ATRIBUTOS DEL DISEÑO ----------
  const captureDesignPreview = async () => {
    const el = stageRef?.current;
    if (!el) return null;
    const { default: html2canvas } = await import("html2canvas");

    const onclone = (doc) => {
      const stage = doc.querySelector('[data-capture-stage="1"]') || doc.body;
      stage.style.overflow = 'visible';
      stage.style.clipPath = 'none';

      const pruneToSelected = (selector, keepIdx) => {
        const track = doc.querySelector(selector);
        if (!track) return;
        const slides = Array.from(track.children);
        slides.forEach((el, i) => { if (i !== keepIdx) el.remove(); });
        track.style.transform = 'none';
        track.style.width = '100%';
      };

      pruneToSelected('[data-capture="pot-track"]',   selectedPotIndex);
      pruneToSelected('[data-capture="plant-track"]', selectedPlantIndex);

      ['[data-capture="pot-container"]','[data-capture="plant-container"]'].forEach(sel => {
        const c = doc.querySelector(sel);
        if (c) {
          c.style.overflow = 'visible';
          c.style.clipPath = 'none';
        }
      });
    };

    const canvas = await html2canvas(el, {
      backgroundColor: "#eeeaeaff",
      scale: 3,
      useCORS: true,
      onclone,
    });

    return canvas.toDataURL("image/png");
  };

  const captureDesignLayerOnly = async () => {
    const el = typeof document !== 'undefined'
      ? document.querySelector('[data-design-layer="1"]')
      : null;
    if (!el) return { png: null, svg: null };

    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(el, {
      backgroundColor: null,
      scale: 3,
      useCORS: true,
    });
    const png = canvas.toDataURL('image/png');

    let svg = null;
    const svgEl =
      el.tagName?.toLowerCase() === 'svg'
        ? el
        : el.querySelector('svg');

    if (svgEl) {
      const s = new XMLSerializer().serializeToString(svgEl);
      svg = `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;
    }

    return { png, svg };
  };

  // ---------- HELPERS CARRITO ----------
  const postCart = (shop, mainVariantId, qty, attrs, accessoryIds, returnTo) => {
    const asStr = (v) => String(v || "").trim();
    const isNum = (v) => /^\d+$/.test(asStr(v));
    const gidToNumericLocal = (id) => {
      const s = asStr(id);
      return s.includes("gid://") ? s.split("/").pop() : s;
    };

    const main = isNum(mainVariantId)
      ? asStr(mainVariantId)
      : gidToNumericLocal(mainVariantId);
    if (!isNum(main)) throw new Error("Variant principal inválido");

    const accs = (accessoryIds || [])
      .map((id) => (isNum(id) ? asStr(id) : gidToNumericLocal(id)))
      .filter(isNum);

    const form = document.createElement("form");
    form.method = "POST";
    form.action = `https://${shop}/cart/add`;
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
        return k === n || k === `_${n}`;
      })?.value || "";
    };

    const previewUrl = getA("DesignPreview");
    const designId = getA("DesignId");
    const designPlant = getA("DesignPlant");
    const designPot = getA("DesignPot");
    const designColor = getA("DesignColor");
    const designSize = getA("DesignSize");

    // DOBO
    add(`items[${line}][id]`, main);
    add(`items[${line}][quantity]`, String(qty || 1));
    add(`items[${line}][properties][_LinePriority]`, "0");
    if (previewUrl) add(`items[${line}][properties][_DesignPreview]`, previewUrl);
    if (designId) add(`items[${line}][properties][_DesignId]`, designId);
    if (designPlant) add(`items[${line}][properties][_DesignPlant]`, designPlant);
    if (designPot) add(`items[${line}][properties][_DesignPot]`, designPot);
    if (designColor) add(`items[${line}][properties][_DesignColor]`, designColor);
    if (designSize) add(`items[${line}][properties][_DesignSize]`, designSize);

    (attrs || []).forEach((a) => {
      const key = a?.key ? String(a.key) : "";
      if (!key) return;
      const k = key.startsWith("_") ? key : `_${key}`;
      add(`items[${line}][properties][${k}]`, a?.value ?? "");
    });
    line++;

    // Accesorios
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
  };

  const getAccessoryVariantIds = () =>
    selectedAccessoryIndices
      .map((i) => accessories[i]?.variants?.[0]?.id)
      .map(gidToNumeric)
      .filter((id) => /^\d+$/.test(id));

  const prepareDesignAttributes = async () => {
    let previewUrl = "";
    try {
      const dataUrl = await captureDesignPreview();
      if (dataUrl) {
        const resp = await fetch("/api/upload-design", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json?.error || "Error al subir preview");
        previewUrl = json.url || "";
      }
    } catch (e) {
      console.warn("No se pudo subir el preview:", e);
    }

    const pot = pots[selectedPotIndex];
    const plant = plants[selectedPlantIndex];
    return [
      { key: "_DesignPreview", value: previewUrl },
      { key: "_DesignId", value: String(Date.now()) },
      { key: "_DesignPlant", value: plant?.id || "" },
      { key: "_DesignPot", value: pot?.id || "" },
      { key: "_DesignColor", value: selectedColor || "" },
      { key: "_DesignSize", value: selectedSize || "" },
      { key: "_LinePriority", value: "0" },
    ];
  };

  // ---------- COMPRAR AHORA ----------
  const buyNow = async () => {
    try {
      const attrs = await prepareDesignAttributes();
      const previewUrl =
        attrs.find((a) => a.key === "_DesignPreview")?.value || "";

      const potPrice = parseFloat(
        selectedPotVariant?.price || pots[selectedPotIndex]?.price || 0
      );
      const plantPrice = parseFloat(plants[selectedPlantIndex]?.price || 0);
      const basePrice = Number(((potPrice + plantPrice) * quantity).toFixed(2));

      const dpRes = await fetch("/api/design-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `DOBO ${plants[selectedPlantIndex]?.title} + ${pots[selectedPotIndex]?.title}`,
          previewUrl,
          price: basePrice,
          color: selectedColor || "Único",
          size: selectedSize || "Único",
          designId: attrs.find((a) => a.key === "_DesignId")?.value,
          plantTitle: plants[selectedPlantIndex]?.title || "Planta",
          potTitle: pots[selectedPotIndex]?.title || "Maceta",
        }),
      });
      const dp = await dpRes.json();
      if (!dpRes.ok || !dp?.variantId)
        throw new Error(dp?.error || "No se creó el producto DOBO");

      const accIds = getAccessoryVariantIds();
      postCart(SHOP_DOMAIN, dp.variantId, quantity, attrs, accIds, "/checkout");
    } catch (e) {
      console.error(e);
      alert(`No se pudo iniciar el checkout: ${e.message}`);
    }
  };

  // ---------- AÑADIR AL CARRO ----------
  const addToCart = async () => {
    try {
      const attrs = await prepareDesignAttributes();
      const previewUrl =
        attrs.find((a) => a.key === "_DesignPreview")?.value || "";

      const potPrice = parseFloat(
        selectedPotVariant?.price || pots[selectedPotIndex]?.price || 0
      );
      const plantPrice = parseFloat(plants[selectedPlantIndex]?.price || 0);
      const basePrice = Number(((potPrice + plantPrice) * quantity).toFixed(2));

      const dpRes = await fetch("/api/design-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `DOBO ${plants[selectedPlantIndex]?.title} + ${pots[selectedPotIndex]?.title}`,
          previewUrl,
          price: basePrice,
          color: selectedColor || "Único",
          size: selectedSize || "Único",
          designId: attrs.find((a) => a.key === "_DesignId")?.value,
          plantTitle: plants[selectedPlantIndex]?.title || "Planta",
          potTitle: pots[selectedPotIndex]?.title || "Maceta",
        }),
      });
      const dp = await dpRes.json();
      if (!dpRes.ok || !dp?.variantId)
        throw new Error(dp?.error || "No se creó el producto DOBO");

      const accIds = getAccessoryVariantIds();
      postCart(SHOP_DOMAIN, dp.variantId, quantity, attrs, accIds, "/cart");
    } catch (e) {
      console.error(e);
      alert(`No se pudo añadir: ${e.message}`);
    }
  };

  // ---------------- UI ----------------
  return (
    <div className={`container mt-5 ${styles.container}`} style={{ paddingBottom: '150px' }}>
      <div className="row justify-content-center align-items-start gx-5 gy-4">
        {/* Carruseles */}
        <div className="col-lg-5 col-md-8 col-12 text-center">

          {/* === ESCENA + BOTONERA ADOSADA === */}
          <div
   className="position-relative"
   ref={sceneWrapRef}
   style={{ 
                width: '500px', 
                height: '800px', 
                background: 'linear-gradient(135deg, #f8f9fa 0%, #ebefe9ff 100%)',
                border: '3px dashed #6c757d',
                borderRadius: '20px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
   }} 
 >


            {/* Nodo ESCALADO (solo la escena) */}
            <div
              ref={stageRef}
              data-capture-stage="1"
              className="d-flex justify-content-center align-items-end"
              style={{
                height: "100%",
                transform: `scale(${zoom})`,
                transformOrigin: "50% 70%",
                transition: "transform 120ms ease"
              }}
            >
              {/* Macetas */}
              <div
                className={styles.carouselContainer}
                ref={potScrollRef}
                data-capture="pot-container"
                style={{ zIndex: 1 }}
                aria-disabled={editing ? "true" : "false"}
              >
                <div
                  className={styles.carouselTrack}
                  data-capture="pot-track"
                  style={{ transform: `translateX(-${selectedPotIndex * 100}%)` }}
                >
                  {pots.map((product, index) => {
                    const isSelected = index === selectedPotIndex;
                    const variantImage = isSelected
                      ? selectedPotVariant?.image || selectedPotVariant?.imageUrl || null
                      : null;
                    const imageUrl = variantImage || product.image;
                    return (
                      <div key={product.id} className={styles.carouselItem}>
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
                style={{
                  zIndex: 2,
                  position: "absolute",
                  bottom: "300px",
                  height: "530px",
                  left: "50%",
                  transform: "translateX(-50%)"
                }}
              >
                <div
                  className={styles.carouselTrack}
                  data-capture="plant-track"
                  style={{ transform: `translateX(-${selectedPlantIndex * 100}%)` }}
                >
                  {plants.map((product) => (
                    <div key={product.id} className={styles.carouselItem}>
                      <img
                        src={product.image}
                        alt={product.title}
                        className={`${styles.carouselImage} ${styles.plantImageOverlay}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Botonera/overlay FUERA del nodo escalado */}
        <CustomizationOverlay
          mode="both"
          stageRef={stageRef}
          anchorRef={potScrollRef}
          containerRef={sceneWrapRef}
          docked={false}
        />

        {/* Información y selección */}
        <div className="col-lg-5 col-md-8 col-12">
          {pots.length > 0 && plants.length > 0 && (
            <div className="text-center">
              {/* Precio combinado */}
              <div
                className="d-flex justify-content-center align-items-baseline gap-3 mb-4"
                style={{ marginTop: "20px" }}
              >
                {getTotalComparePrice() > getTotalPrice() && (
                  <span
                    className="text-muted"
                    style={{
                      textDecoration: "line-through",
                      fontSize: "1.2rem",
                    }}
                  >
                    ${(getTotalComparePrice() * quantity).toFixed(0)}
                  </span>
                )}
               {selectedPotVariant?.price && (
  <p style={{ marginTop: 8 }}>
    Precio maceta: {money(
      // usa amount si existe, si no usa price numérico plano
      (selectedPotVariant.price.amount ?? selectedPotVariant.price),
      selectedPotVariant.price.currencyCode || 'CLP'
    )}
  </p>
)}


<span style={{ fontWeight: "bold", fontSize: "3rem" }}>
                  ${(getTotalPrice() * quantity).toFixed(0)}
                </span>
                  <span style={{ fontWeight: "bold", fontSize: "3rem" }}>
  {money(getTotalPrice() * quantity, selectedPotVariant?.price?.currencyCode || 'CLP')}
</span>

              </div>

              {/* Color */}
              {colorOptions.length > 0 && (
                <div className="mb-4">
                  <h5>Color</h5>
                  <div className="d-flex justify-content-center gap-3 flex-wrap">
                    {colorOptions.map((color, index) => {
                      const pot = pots[selectedPotIndex];
                      const disponible = hasVariantOwnImage({
                        pot,
                        color,
                        size: selectedSize,
                      });
                      return (
                        <div
                          key={index}
                          onClick={() => disponible && setSelectedColor(color)}
                          style={{
                            position: "relative",
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            backgroundColor: colorMap[color] || "#ccc",
                            border:
                              selectedColor === color
                                ? "3px solid black"
                                : "1px solid #ccc",
                            cursor: disponible ? "pointer" : "not-allowed",
                            opacity: disponible ? 1 : 0.35,
                            filter: disponible ? "none" : "grayscale(100%)",
                            pointerEvents: disponible ? "auto" : "none",
                            boxShadow:
                              selectedColor === color
                                ? "0 0 5px rgba(0,0,0,0.5)"
                                : "none",
                          }}
                          title={color}
                        >
                          {!disponible && (
                            <div
                              style={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                width: "46px",
                                height: "2px",
                                background: "#000",
                                opacity: 0.6,
                                transform:
                                  "translate(-50%, -50%) rotate(45deg)",
                                pointerEvents: "none",
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tamaño */}
              {sizeOptions.length > 0 && (
                <div className="mb-4">
                  <h5>Tamaño</h5>
                  <div className="d-flex justify-content-center gap-3 flex-wrap">
                    {sizeOptions.map((size, index) => {
                      const pot = pots[selectedPotIndex];
                      const disponible = hasVariantOwnImage({
                        pot,
                        color: selectedColor,
                        size,
                      });
                      return (
                        <button
                          key={index}
                          onClick={() => disponible && setSelectedSize(size)}
                          className={`btn ${
                            selectedSize === size
                              ? "btn-dark"
                              : "btn-outline-secondary"
                          }`}
                          style={{
                            cursor: disponible ? "pointer" : "not-allowed",
                            opacity: disponible ? 1 : 0.35,
                            filter: disponible ? "none" : "grayscale(100%)",
                            pointerEvents: disponible ? "auto" : "none",
                            textDecoration: disponible ? "none" : "line-through",
                          }}
                          disabled={!disponible}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Accesorios */}
              {accessories && accessories.length > 0 && (
                <div className="mb-4">
                  <h5>Accesorios</h5>
                  <div className="d-flex justify-content-center gap-3 flex-wrap">
                    {accessories.map(function(product, index){
                      const img = product && product.image
                        ? (product.image.src || product.image)
                        : (product && product.images && product.images[0] && product.images[0].src
                            ? product.images[0].src
                            : "/placeholder.png");

                      const title = product && (product.title || product.name)
                        ? (product.title || product.name)
                        : "Accesorio " + (index + 1);

                      const selected = selectedAccessoryIndices && selectedAccessoryIndices.includes(index);

                      return (
                        <div
                          key={(product && product.id) ? product.id : index}
                          onClick={function(e){ handleAccClick(e, product); toggleAccessory(index); }}
                          onMouseEnter={function(e){ handleAccEnter(e, product); }}
                          onMouseMove={handleAccMove}
                          onMouseLeave={handleAccLeave}
                          aria-label={title}
                          style={{
                            border: selected ? "3px solid black" : "1px solid #ccc",
                            borderRadius: "12px",
                            padding: "6px",
                            cursor: "zoom-in",
                            width: "100px",
                            height: "100px",
                            overflow: "hidden",
                            transition: "transform 0.2s ease"
                          }}
                        >
                          <img
                            src={img}
                            alt={title}
                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "6px" }}
                          />
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
                  <div
                    className="input-group justify-content-center"
                    style={{ maxWidth: "200px", margin: "0 auto" }}
                  >
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() =>
                        setQuantity((prev) => Math.max(1, prev - 1))
                      }
                    >
                      -
                    </button>
                    <input
                      type="number"
                      className="form-control text-center"
                      value={quantity}
                      min="1"
                      max="1000"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d*$/.test(val)) {
                          const num = parseInt(val, 10);
                          if (!isNaN(num) && num >= 1 && num <= 1000) {
                            setQuantity(num);
                          } else if (val === "") {
                            setQuantity("");
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const num = parseInt(e.target.value, 10);
                        if (isNaN(num) || num < 1) setQuantity(1);
                        else if (num > 1000) setQuantity(1000);
                      }}
                    />
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() =>
                        setQuantity((prev) => Math.min(1000, prev + 1))
                      }
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="d-flex gap-3">
                  <button
                    className="btn btn-outline-dark px-4 py-2"
                    onClick={addToCart}
                  >
                    Añadir al carro
                  </button>
                  <button className="btn btn-dark px-4 py-2" onClick={buyNow}>
                    Comprar ahora
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Descripciones */}
          <div
            className="text-start px-3 mb-4"
            style={{ maxWidth: "500px", margin: "0 auto" }}
          >
            <h6>
              <strong>Planta</strong>
            </h6>
            <p style={{ fontSize: "1.2rem" }}>
              {plants[selectedPlantIndex]?.description ||
                "Descripción de la planta no disponible."}
            </p>
            <h6>
              <strong>Maceta</strong>
            </h6>
            <p style={{ fontSize: "1.2rem" }}>
              {pots[selectedPotIndex]?.description ||
                "Descripción de la maceta no disponible."}
            </p>
          </div>
        </div>
      </div>

      {/* Preview flotante */}
      <IframePreview
        visible={accPreview.visible}
        x={accPreview.x}
        y={accPreview.y}
        html={accPreview.html}
        onClose={() => setAccPreview(p => ({ ...p, visible:false }))}
      />

      {/* CSS global para el bloqueo del carrusel de macetas */}
      <style jsx global>{`
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
  );
}
