// pages/index.js
import { useEffect, useState, useRef } from "react";
import styles from "../styles/home.module.css";
import "bootstrap/dist/css/bootstrap.min.css";
import dynamic from "next/dynamic";

/* ---------- helpers precio & num ---------- */
const money = (amount, currency = "CLP") =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

const num = (v) => Number(typeof v === "object" ? v?.amount : v || 0);
const firstVariantPrice = (p) => {
  const v = p?.variants?.[0]?.price;
  return v ? num(v) : num(p?.minPrice);
};
const productMin = (p) => num(p?.minPrice);

/* ---------- hover zoom helpers ---------- */
const escapeHtml = (s) =>
  (s &&
    s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]))) ||
  "";

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
  <h4>${escapeHtml(title || "")}</h4>
  <p>${escapeHtml(desc || "")}</p>
</div></body></html>`;

function getPreviewRect() {
  if (typeof window === "undefined") return { w: 360, h: 360, centered: false };
  const isMobile = window.innerWidth <= 768;
  const w = isMobile ? Math.min(window.innerWidth - 24, 420) : 360;
  const h = isMobile ? Math.min(Math.floor(window.innerHeight * 0.6), 520) : 360;
  return { w, h, centered: isMobile };
}

function IframePreview(props) {
  if (!props.visible) return null;
  const dims = getPreviewRect();
  const base = {
    position: "fixed",
    borderRadius: 12,
    overflow: "hidden",
    background: "#fff",
    boxShadow: "0 12px 32px rgba(0,0,0,.24)",
    zIndex: 9999,
    pointerEvents: "none",
  };
  const style = dims.centered
    ? { ...base, left: "50%", bottom: 12, transform: "translateX(-50%)", width: dims.w, height: dims.h }
    : { ...base, left: props.x, top: props.y, width: dims.w, height: dims.h };

  return (
    <div style={style}>
      <iframe srcDoc={props.html} style={{ width: "100%", height: "100%", border: 0, pointerEvents: "none" }} />
    </div>
  );
}

/* ---------- dynamic overlay ---------- */
const CustomizationOverlay = dynamic(() => import("../components/CustomizationOverlay"), { ssr: false });

/* ---------- shop ---------- */
const SHOP_DOMAIN = "um7xus-0u.myshopify.com";

/* ---------- swipe factory (hoisted) ---------- */
function makeSwipeEvents(swipeRef, handlers) {
  const begin = (x, y, id, el) => {
    swipeRef.current = { active: true, id, x, y };
    if (id != null && el?.setPointerCapture) el.setPointerCapture(id);
  };
  const end = (ev, el) => {
    const id = swipeRef.current?.id;
    if (id != null && el?.releasePointerCapture) el.releasePointerCapture(id);
    swipeRef.current = { active: false, id: null, x: 0, y: 0 };
  };
  const move = (x, y, ev, el) => {
    const s = swipeRef.current;
    if (!s?.active) return;
    const dx = x - s.x,
      dy = y - s.y;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      ev.preventDefault();
      if (Math.abs(dx) > 48) {
        dx > 0 ? handlers.prev() : handlers.next();
        end(ev, el);
      }
    }
  };
  return {
    onPointerDown: (e) => begin(e.clientX, e.clientY, e.pointerId ?? null, e.currentTarget),
    onPointerMove: (e) => move(e.clientX, e.clientY, e, e.currentTarget),
    onPointerUp: (e) => end(e, e.currentTarget),
    onPointerCancel: (e) => end(e, e.currentTarget),
    onTouchStart: (e) => {
      const t = e.touches[0];
      begin(t.clientX, t.clientY, null, e.currentTarget);
    },
    onTouchMove: (e) => {
      const t = e.touches[0];
      move(t.clientX, t.clientY, e, e.currentTarget);
    },
    onTouchEnd: (e) => end(e, e.currentTarget),
    onTouchCancel: (e) => end(e, e.currentTarget),
    onMouseDown: (e) => begin(e.clientX, e.clientY, null, e.currentTarget),
    onMouseMove: (e) => move(e.clientX, e.clientY, e, e.currentTarget),
    onMouseUp: (e) => end(e, e.currentTarget),
  };
}

export default function Home() {
  /* ---------- state ---------- */
  const [plants, setPlants] = useState([]);
  const [pots, setPots] = useState([]);
  const [accessories, setAccessories] = useState([]);

  const [selectedPlantIndex, setSelectedPlantIndex] = useState(0);
  const [selectedPotIndex, setSelectedPotIndex] = useState(0);
  const [selectedPotVariant, setSelectedPotVariant] = useState(null);

  const [selectedAccessoryIndices, setSelectedAccessoryIndices] = useState([]);
  const [quantity, setQuantity] = useState(1);



  const [accPreview, setAccPreview] = useState({ visible: false, x: 0, y: 0, html: "" });

  const [selectedColor, setSelectedColor] = useState(null);
  const [colorOptions, setColorOptions] = useState([]);
  const [selectedSize, setSelectedSize] = useState(null);
  const [sizeOptions, setSizeOptions] = useState([]);

  const [cartId, setCartId] = useState(null);

  /* ---------- refs ---------- */
  const zoomRef = useRef(1);
  const sceneWrapRef = useRef(null);
  const stageRef = useRef(null);
  const plantScrollRef = useRef(null);
  const potScrollRef = useRef(null);
  const plantSwipeRef = useRef({ active: false, id: null, x: 0, y: 0 });
  const potSwipeRef = useRef({ active: false, id: null, x: 0, y: 0 });
  
  const [editing, setEditing] = useState(false);
  /* ---------- editing flag ---------- */
  useEffect(() => {
    const onFlag = (e) => setEditing(!!e.detail?.editing);
    window.addEventListener("dobo-editing", onFlag);
    return () => window.removeEventListener("dobo-editing", onFlag);
  }, []);

// Conmutar touch-action al entrar/salir de “Diseñar” (móvil)
useEffect(() => {
  const s = stageRef.current;
  const c = sceneWrapRef.current;
  if (!s || !c) return;

  const prevS = s.style.touchAction;
  const prevC = c.style.touchAction;

  if (editing) {
    // En modo diseño: que Fabric reciba los gestos (drag/pinch)
    s.style.touchAction = 'none';
    c.style.touchAction = 'none';
  } else {
    // Fuera de diseño: permitir scroll vertical normal
    s.style.touchAction = 'pan-y';
    c.style.touchAction = 'pan-y';
  }

  return () => {
    s.style.touchAction = prevS;
    c.style.touchAction = prevC;
  };
}, [editing]);

  
  // Conmutar touch-action al entrar/salir de “Diseñar” (móvil)
useEffect(() => {
  const s = stageRef.current;
  const c = sceneWrapRef.current;
  if (!s || !c) return;

  const prevS = s.style.touchAction;
  const prevC = c.style.touchAction;

  if (editing) {
    // En modo diseño: que Fabric reciba los gestos (drag/pinch)
    s.style.touchAction = 'none';
    c.style.touchAction = 'none';
  } else {
    // Fuera de diseño: permitir scroll vertical normal
    s.style.touchAction = 'pan-y';
    c.style.touchAction = 'pan-y';
  }

  return () => {
    s.style.touchAction = prevS;
    c.style.touchAction = prevC;
  };
}, [editing]);

  
  /* ---------- cart persist ---------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("cartId");
    if (saved) setCartId(saved);
  }, []);
  useEffect(() => {
    if (cartId && typeof window !== "undefined") {
      window.localStorage.setItem("cartId", cartId);
    }
  }, [cartId]);

  /* ---------- color image availability ---------- */
  const hasVariantOwnImage = ({ pot, color, size }) => {
    if (!pot?.variants) return false;
    const n = (x) => (x ?? "").toString().trim().toLowerCase();
    const nColor = color ? n(color) : null;
    const nSize = size ? n(size) : null;
    return pot.variants.some((v) => {
      if (!v?.image && !v?.hasOwnImage) return false;
      const opts = v.selectedOptions || [];
      const matchColor = nColor ? opts.some((o) => n(o.name) === "color" && n(o.value) === nColor) : true;
      const matchSize = nSize
        ? opts.some((o) => (n(o.name) === "tamaño" || n(o.name) === "size") && n(o.value) === nSize)
        : true;
      return matchColor && matchSize;
    });
  };

  /* ---------- color map ---------- */
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

  /* ---------- fetch products ---------- */
  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const arr = Array.isArray(data) ? data : [];
        const safe = arr.map((p) => ({
          ...p,
          description: p?.description || p?.descriptionHtml || p?.body_html || "",
          tags: Array.isArray(p?.tags) ? p.tags : [],
          variants: Array.isArray(p?.variants) ? p.variants : [],
          image: p?.image?.src || p?.image || (Array.isArray(p?.images) && p.images[0]?.src) || "",
          minPrice: p?.minPrice || { amount: 0, currencyCode: "CLP" },
        }));

        const byTag = (t) => safe.filter((p) => p.tags.some((tag) => String(tag).toLowerCase().includes(t)));

        let plantas = byTag("plantas");
        let macetas = byTag("macetas");
        let accesorios = byTag("accesorios");

        if (plantas.length + macetas.length + accesorios.length === 0 && safe.length > 0) {
          macetas = safe;
          plantas = [];
          accesorios = [];
        }

        setPlants(plantas);
        setPots(macetas);
        setAccessories(accesorios);

        if (macetas.length > 0) {
          const fv = (macetas[0].variants || []).find((v) => v?.availableForSale) || macetas[0].variants?.[0] || null;
          setSelectedPotVariant(fv || null);
        }
      } catch (err) {
        console.error("Error fetching products:", err);
        setPlants([]);
        setPots([]);
        setAccessories([]);
      }
    }
    fetchProducts();
  }, []);

  /* ---------- handlers & swipe events (AFTER they're defined) ---------- */
  const createHandlers = (items, setIndex) => ({
    prev: () => setIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1)),
    next: () => setIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0)),
  });
  const plantHandlers = createHandlers(plants, setSelectedPlantIndex);
  const potHandlers = createHandlers(pots, setSelectedPotIndex);

  const plantSwipeEvents = makeSwipeEvents(plantSwipeRef, plantHandlers);
  const potSwipeEvents = makeSwipeEvents(potSwipeRef, potHandlers);

  /* ---------- lock pot carousel while editing ---------- */
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

      try {
        el.inert = true;
      } catch {}
      el.classList.add("pot-carousel--locked");

      const optsPF = { capture: true, passive: false };
      const optsCap = { capture: true };

      ["wheel", "touchstart", "touchmove"].forEach((t) => el.addEventListener(t, block, optsPF));
      ["touchend", "pointerdown", "pointerup", "click", "dblclick", "contextmenu", "keydown", "dragstart", "mousedown", "mousemove", "mouseup"].forEach(
        (t) => el.addEventListener(t, block, optsCap)
      );
      el.addEventListener("scroll", freezeScroll, optsCap);

      return () => {
        el.classList.remove("pot-carousel--locked");
        try {
          el.inert = false;
        } catch {}
        ["wheel", "touchstart", "touchmove"].forEach((t) => el.removeEventListener(t, block, optsPF));
        ["touchend", "pointerdown", "pointerup", "click", "dblclick", "contextmenu", "keydown", "dragstart", "mousedown", "mousemove", "mouseup"].forEach(
          (t) => el.removeEventListener(t, block, optsCap)
        );
        el.removeEventListener("scroll", freezeScroll, optsCap);
        restoreTab();
      };
    } else {
      el.classList.remove("pot-carousel--locked");
      try {
        el.inert = false;
      } catch {}
    }
  }, [editing]);

  /* ---------- zoom wheel + pinch ---------- */
  useEffect(() => {
    const container = sceneWrapRef.current;
    const stage = stageRef.current;
    if (!container || !stage) return;

    zoomRef.current = zoomRef.current || 1;
    stage.style.setProperty("--zoom", String(zoomRef.current));

    const MIN = 0.8,
      MAX = 2.5;
    let target = zoomRef.current;
    let raf = 0;

    const clamp = (v) => Math.min(MAX, Math.max(MIN, v));
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        stage.style.setProperty("--zoom", String(target));
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

    // pinch
    const pts = new Map();
    let startDist = 0,
      startScale = zoomRef.current;
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    const onPD = (e) => {
      if (e.pointerType !== "touch") return;
      container.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [p1, p2] = [...pts.values()];
        startDist = dist(p1, p2);
        startScale = zoomRef.current;
      }
    };
    const onPM = (e) => {
      if (e.pointerType !== "touch" || !pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && startDist > 0) {
        const [p1, p2] = [...pts.values()];
        const factor = dist(p1, p2) / startDist;
        zoomRef.current = clamp(startScale * Math.pow(factor, 0.9));
        target = zoomRef.current;
        schedule();
        e.preventDefault();
      }
    };
    const onPU = (e) => {
      if (e.pointerType !== "touch") return;
      pts.delete(e.pointerId);
      if (pts.size < 2) {
        startDist = 0;
        startScale = zoomRef.current;
      }
    };

    container.addEventListener("pointerdown", onPD, { passive: false });
    container.addEventListener("pointermove", onPM, { passive: false });
    window.addEventListener("pointerup", onPU, { passive: true });
    window.addEventListener("pointercancel", onPU, { passive: true });

    return () => {
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("pointerdown", onPD);
      container.removeEventListener("pointermove", onPM);
      window.removeEventListener("pointerup", onPU);
      window.removeEventListener("pointercancel", onPU);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* ---------- accessory preview ---------- */
  function openAccPreview(e, acc) {
    const img =
      acc && acc.image
        ? acc.image.src || acc.image
        : acc && acc.images && acc.images[0] && acc.images[0].src
        ? acc.images[0].src
        : "";
    const title = acc && (acc.title || acc.name) ? acc.title || acc.name : "";
    const desc = acc ? acc.description || acc.body_html || "" : "";
    const cx = e && typeof e.clientX === "number" ? e.clientX : 0;
    const cy = e && typeof e.clientY === "number" ? e.clientY : 0;
    setAccPreview({ visible: true, x: cx + 16, y: cy + 16, html: buildIframeHTML(img, title, desc) });
  }
  const handleAccEnter = (e, acc) => openAccPreview(e, acc);
  const handleAccMove = (e) => {
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
    if (isMobile) return;
    setAccPreview((p) => (p.visible ? { ...p, x: e.clientX + 16, y: e.clientY + 16 } : p));
  };
  const handleAccLeave = () => setAccPreview((p) => ({ ...p, visible: false }));
  const handleAccClick = (e, acc) => {
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
    if (isMobile) {
      if (accPreview.visible) handleAccLeave();
      else openAccPreview(e, acc);
    } else {
      openAccPreview(e, acc);
    }
  };

  /* ---------- variantes: opciones y selección ---------- */
  useEffect(() => {
    const pot = pots[selectedPotIndex];
    if (!pot) {
      setColorOptions([]);
      setSizeOptions([]);
      setSelectedPotVariant(null);
      return;
    }

    const valid = (pot.variants || []).filter((v) => !!v.image);
    const lower = (s) => (s ?? "").toString().trim().toLowerCase();

    const colors = [
      ...new Set(
        valid.flatMap((v) => (v.selectedOptions || []).filter((o) => lower(o.name) === "color").map((o) => o.value))
      ),
    ];
    const sizes = [
      ...new Set(
        valid.flatMap((v) =>
          (v.selectedOptions || [])
            .filter((o) => {
              const n = lower(o.name);
              return n === "tamaño" || n === "size";
            })
            .map((o) => o.value)
        )
      ),
    ];

    setColorOptions(colors);
    setSizeOptions(sizes);

    if (!selectedSize || !sizes.includes(selectedSize)) {
      if (sizes.length >= 2) setSelectedSize(sizes[1]);
      else if (sizes.length === 1) setSelectedSize(sizes[0]);
      else setSelectedSize(null);
    }

    const variantMatches = (v, color, size) => {
      const opts = v.selectedOptions || [];
      const colorOK = color ? opts.some((o) => lower(o.name) === "color" && lower(o.value) === lower(color)) : true;
      const sizeOK = size
        ? opts.some((o) => {
            const n = lower(o.name);
            return (n === "tamaño" || n === "size") && lower(o.value) === lower(size);
          })
        : true;
      return colorOK && sizeOK;
    };

    if (!(selectedColor && valid.some((v) => variantMatches(v, selectedColor, selectedSize)))) {
      const firstColor = colors.find((c) => valid.some((v) => variantMatches(v, c, selectedSize)));
      if (firstColor) setSelectedColor(firstColor);
    }

    const chosen = valid.find((v) => variantMatches(v, selectedColor, selectedSize)) || valid[0] || null;
    setSelectedPotVariant(chosen || null);
  }, [pots, selectedPotIndex, selectedColor, selectedSize]);

  /* ---------- totales ---------- */
  const getTotalPrice = () => {
    const pot = pots[selectedPotIndex];
    const plant = plants[selectedPlantIndex];

    const potPrice = selectedPotVariant?.price ? num(selectedPotVariant.price) : firstVariantPrice(pot);
    const plantPrice = productMin(plant);

    const accTotal = selectedAccessoryIndices.reduce((s, i) => {
      const acc = accessories[i];
      const v = acc?.variants?.[0]?.price;
      return s + (v ? num(v) : productMin(acc));
    }, 0);

    return potPrice + plantPrice + accTotal;
  };

  const getTotalComparePrice = () => {
    const pot = pots[selectedPotIndex];
    const plant = plants[selectedPlantIndex];

    const potCmp = selectedPotVariant?.compareAtPrice
      ? num(selectedPotVariant.compareAtPrice)
      : selectedPotVariant?.price
      ? num(selectedPotVariant.price)
      : firstVariantPrice(pot);

    const plantCmp = productMin(plant);

    const accCmp = selectedAccessoryIndices.reduce((s, i) => {
      const acc = accessories[i];
      const base = acc?.variants?.[0]?.compareAtPrice ?? acc?.variants?.[0]?.price ?? acc?.minPrice;
      return s + num(base);
    }, 0);

    return potCmp + plantCmp + accCmp;
  };

  /* ---------- id helpers ---------- */
  const gidToNumeric = (id) => {
    const s = String(id || "");
    return s.includes("gid://") ? s.split("/").pop() : s;
  };

  /* ---------- captura preview ---------- */
  const captureDesignPreview = async () => {
    const el = stageRef?.current;
    if (!el) return null;
    const { default: html2canvas } = await import("html2canvas");

    const onclone = (doc) => {
      const stage = doc.querySelector('[data-capture-stage="1"]') || doc.body;
      stage.style.overflow = "visible";
      stage.style.clipPath = "none";

      const pruneToSelected = (selector, keepIdx) => {
        const track = doc.querySelector(selector);
        if (!track) return;
        const slides = Array.from(track.children);
        slides.forEach((el, i) => {
          if (i !== keepIdx) el.remove();
        });
        track.style.transform = "none";
        track.style.width = "100%";
      };

      pruneToSelected('[data-capture="pot-track"]', selectedPotIndex);
      pruneToSelected('[data-capture="plant-track"]', selectedPlantIndex);

      ["[data-capture=\"pot-container\"]", "[data-capture=\"plant-container\"]"].forEach((sel) => {
        const c = doc.querySelector(sel);
        if (c) {
          c.style.overflow = "visible";
          c.style.clipPath = "none";
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

  /* ---------- cart post ---------- */
  const postCart = (shop, mainVariantId, qty, attrs, accessoryIds, returnTo) => {
    const asStr = (v) => String(v || "").trim();
    const isNum = (v) => /^\d+$/.test(asStr(v));
    const gidToNumericLocal = (id) => {
      const s = asStr(id);
      return s.includes("gid://") ? s.split("/").pop() : s;
    };

    const main = isNum(mainVariantId) ? asStr(mainVariantId) : gidToNumericLocal(mainVariantId);
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

    add(`items[${line}][id]`, main);
    add(`items[${line}][quantity]`, String(qty || 1));
    add(`items[${line}][properties][_LinePriority]`, "0");
    if (previewUrl) add(`items[${line}][properties][_DesignPreview]`, previewUrl);
    if (designId) add(`items[${line}][properties][_DesignId]`, designId);
    if (designPlant) add(`items[${line}][properties][_DesignPlant]`, designPlant);
    if (designPot) add(`items[${line}][properties][_DesignPot]`, designPot);
    if (designColor) add(`items[${line}][properties][_DesignColor]`, designColor);
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
  };

  /* ---------- actions ---------- */
  const getAccessoryVariantIds = () =>
    selectedAccessoryIndices.map((i) => accessories[i]?.variants?.[0]?.id).map(gidToNumeric).filter((id) => /^\d+$/.test(id));

  const buyNow = async () => {
    try {
      const attrs = await prepareDesignAttributes();
      const previewUrl = attrs.find((a) => a.key === "_DesignPreview")?.value || "";

      const potPrice = selectedPotVariant?.price ? num(selectedPotVariant.price) : firstVariantPrice(pots[selectedPotIndex]);
      const plantPrice = productMin(plants[selectedPlantIndex]);
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
      if (!dpRes.ok || !dp?.variantId) throw new Error(dp?.error || "No se creó el producto DOBO");

      const accIds = getAccessoryVariantIds();
      postCart(SHOP_DOMAIN, dp.variantId, quantity, attrs, accIds, "/checkout");
    } catch (e) {
      console.error(e);
      alert(`No se pudo iniciar el checkout: ${e.message}`);
    }
  };

  const addToCart = async () => {
    try {
      const attrs = await prepareDesignAttributes();
      const previewUrl = attrs.find((a) => a.key === "_DesignPreview")?.value || "";

      const potPrice = selectedPotVariant?.price ? num(selectedPotVariant.price) : firstVariantPrice(pots[selectedPotIndex]);
      const plantPrice = productMin(plants[selectedPlantIndex]);
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
      if (!dpRes.ok || !dp?.variantId) throw new Error(dp?.error || "No se creó el producto DOBO");

      const accIds = getAccessoryVariantIds();
      postCart(SHOP_DOMAIN, dp.variantId, quantity, attrs, accIds, "/cart");
    } catch (e) {
      console.error(e);
      alert(`No se pudo añadir: ${e.message}`);
    }
  };

  /* ---------- UI ---------- */
  const baseCode = selectedPotVariant?.price?.currencyCode || "CLP";
  const totalNow = getTotalPrice() * quantity;
  const totalBase = getTotalComparePrice() * quantity;

  return (
    <div className={`container mt-5 ${styles.container}`} style={{ paddingBottom: "150px" }}>
      <div className="row justify-content-center align-items-start gx-5 gy-4">
        {/* Carruseles */}
        <div className="col-lg-5 col-md-8 col-12 text-center">
          {/* Escena */}
          <div
            className="position-relative"
            ref={sceneWrapRef}
            style={{
              width: "450px",
              height: "700px",
              background: "linear-gradient(135deg, #f8f9fa 0%, #ebefe9ff 100%)",
              border: "3px dashed #6c757d",
              borderRadius: "20px",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              touchAction: "pan-y",
              userSelect: "none",
            }}
          >
            {/* Nodo ESCALADO */}
            <div
              ref={stageRef}
              data-capture-stage="1"
              className="d-flex justify-content-center align-items-end"
              style={{
                height: "100%",
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
                aria-disabled={editing ? "true" : "false"}
                {...potSwipeEvents}
              >
                <div className={styles.carouselTrack} data-capture="pot-track" style={{ transform: `translateX(-${selectedPotIndex * 100}%)` }}>
                  {pots.map((product, index) => {
                    const isSelected = index === selectedPotIndex;
                    const variantImage = isSelected ? selectedPotVariant?.image || selectedPotVariant?.imageUrl || null : null;
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
                  transform: "translateX(-50%)",
                  touchAction: "pan-y",
                  userSelect: "none",
                }}
                {...plantSwipeEvents}
              >
                <div className={styles.carouselTrack} data-capture="plant-track" style={{ transform: `translateX(-${selectedPlantIndex * 100}%)` }}>
                  {plants.map((product) => (
                    <div key={product.id} className={styles.carouselItem}>
                      <img src={product.image} alt={product.title} className={`${styles.carouselImage} ${styles.plantImageOverlay}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Overlay de edición */}
        <CustomizationOverlay mode="both" stageRef={stageRef} anchorRef={potScrollRef} containerRef={sceneWrapRef} docked={false} />

        {/* Información y selección */}
        <div className="col-lg-5 col-md-8 col-12">
          {pots.length > 0 && plants.length > 0 && (
            <div className="text-center">
              {/* Precio combinado */}
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
                      const pot = pots[selectedPotIndex];
                      const disponible = hasVariantOwnImage({ pot, color, size: selectedSize });
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
                            border: selectedColor === color ? "3px solid black" : "1px solid #ccc",
                            cursor: disponible ? "pointer" : "not-allowed",
                            opacity: disponible ? 1 : 0.35,
                            filter: disponible ? "none" : "grayscale(100%)",
                            pointerEvents: disponible ? "auto" : "none",
                            boxShadow: selectedColor === color ? "0 0 5px rgba(0,0,0,0.5)" : "none",
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
                                transform: "translate(-50%, -50%) rotate(45deg)",
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
                      const disponible = hasVariantOwnImage({ pot, color: selectedColor, size });
                      return (
                        <button
                          key={index}
                          onClick={() => disponible && setSelectedSize(size)}
                          className={`btn ${selectedSize === size ? "btn-dark" : "btn-outline-secondary"}`}
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
                    {accessories.map((product, index) => {
                      const img =
                        product && product.image
                          ? product.image.src || product.image
                          : product && product.images && product.images[0] && product.images[0].src
                          ? product.images[0].src
                          : "/placeholder.png";
                      const title = product && (product.title || product.name) ? product.title || product.name : `Accesorio ${index + 1}`;
                      const selected = selectedAccessoryIndices.includes(index);

                      return (
                        <div
                          key={product?.id || index}
                          onClick={(e) => {
                            handleAccClick(e, product);
                            setSelectedAccessoryIndices((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
                          }}
                          onMouseEnter={(e) => handleAccEnter(e, product)}
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
                  <div className="input-group justify-content-center" style={{ maxWidth: "200px", margin: "0 auto" }}>
                    <button className="btn btn-outline-secondary" onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}>
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
                          const n = parseInt(val, 10);
                          if (!isNaN(n) && n >= 1 && n <= 1000) setQuantity(n);
                          else if (val === "") setQuantity("");
                        }
                      }}
                      onBlur={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (isNaN(n) || n < 1) setQuantity(1);
                        else if (n > 1000) setQuantity(1000);
                      }}
                    />
                    <button className="btn btn-outline-secondary" onClick={() => setQuantity((prev) => Math.min(1000, prev + 1))}>
                      +
                    </button>
                  </div>
                </div>

                <div className="d-flex gap-3">
                  <button className="btn btn-outline-dark px-4 py-2" onClick={addToCart}>
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
          <div className="text-start px-3 mb-4" style={{ maxWidth: "500px", margin: "0 auto" }}>
            <h6>
              <strong>Planta</strong>
            </h6>
            {(() => {
              const d = plants[selectedPlantIndex]?.description;
              return d && /<[^>]+>/.test(d) ? (
                <div style={{ fontSize: "1.2rem" }} dangerouslySetInnerHTML={{ __html: d }} />
              ) : (
                <p style={{ fontSize: "1.2rem" }}>{d || "Descripción de la planta no disponible."}</p>
              );
            })()}

            <h6 className="mt-3">
              <strong>Maceta</strong>
            </h6>
            {(() => {
              const d = pots[selectedPotIndex]?.description;
              return d && /<[^>]+>/.test(d) ? (
                <div style={{ fontSize: "1.2rem" }} dangerouslySetInnerHTML={{ __html: d }} />
              ) : (
                <p style={{ fontSize: "1.2rem" }}>{d || "Descripción de la maceta no disponible."}</p>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Preview flotante */}
      <IframePreview
        visible={accPreview.visible}
        x={accPreview.x}
        y={accPreview.y}
        html={accPreview.html}
        onClose={() => setAccPreview((p) => ({ ...p, visible: false }))}
      />

      {/* CSS global para bloqueo del carrusel de macetas */}
      <style jsx global>{`
        .pot-carousel--locked {
          pointer-events: none;
          user-select: none;
          -webkit-user-drag: none;
          touch-action: none;
          overflow: hidden !important;
          scrollbar-width: none;
        }
        .pot-carousel--locked::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
