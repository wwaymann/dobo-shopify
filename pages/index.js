// pages/index.js
import { useEffect, useState, useRef } from "react";
import styles from "../styles/home.module.css";
import "bootstrap/dist/css/bootstrap.min.css";
import dynamic from "next/dynamic";

/* ---------- helpers tamaño ---------- */
const getSizeTag = (tags = []) => {
  if (!Array.isArray(tags)) return "";
  const n = (s) => String(s || "").trim().toLowerCase();
  const hit = tags.find((t) =>
    [
      "grande",
      "mediana",
      "mediano",
      "pequeña",
      "pequena",
      "pequeño",
      "pequeno",
      "perqueña",
      "perquena",
    ].includes(n(t))
  );
  if (!hit) return "";
  const h = n(hit);
  if (h === "grande") return "Grande";
  if (h === "mediana" || h === "mediano") return "Mediana";
  return "Pequeña";
};

/* ---------- precio ---------- */
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

/* ---------- preview accesorios ---------- */
const escapeHtml = (s) =>
  (s &&
    s.replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[m])) ||
  "";
const buildIframeHTML = (imgUrl, title, desc) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}body{margin:0;background:#fff;font-family:system-ui,sans-serif}
.wrap{padding:8px;display:flex;flex-direction:column;align-items:center;gap:8px}
img{max-width:100%;height:auto;display:block}
h4{margin:0;font-size:14px;font-weight:600;text-align:center}
p{margin:0;font-size:12px;line-height:1.35;text-align:center;color:#333}
</style></head><body><div class="wrap">
<img src="${escapeHtml(imgUrl)}" alt=""><h4>${escapeHtml(title||"")}</h4><p>${escapeHtml(desc||"")}</p>
</div></body></html>`;
function getPreviewRect() {
  if (typeof window === "undefined") return { w: 360, h: 360, centered: false };
  const m = window.innerWidth <= 768;
  const w = m ? Math.min(window.innerWidth - 24, 420) : 360;
  const h = m ? Math.min(Math.floor(window.innerHeight * 0.6), 520) : 360;
  return { w, h, centered: m };
}
function IframePreview(props) {
  if (!props.visible) return null;
  const d = getPreviewRect();
  const base = {
    position: "fixed",
    borderRadius: 12,
    overflow: "hidden",
    background: "#fff",
    boxShadow: "0 12px 32px rgba(0,0,0,.24)",
    zIndex: 9999,
    pointerEvents: "none",
  };
  const style = d.centered
    ? {
        ...base,
        left: "50%",
        bottom: 12,
        transform: "translateX(-50%)",
        width: d.w,
        height: d.h,
      }
    : { ...base, left: props.x, top: props.y, width: d.w, height: d.h };
  return (
    <div style={style}>
      <iframe
        srcDoc={props.html}
        style={{ width: "100%", height: "100%", border: 0, pointerEvents: "none" }}
      />
    </div>
  );
}

/* ---------- dots ---------- */
function IndicatorDots({ count, current, onSelect, position = "bottom" }) {
  if (!count || count < 2) return null;
  return (
    <div
      className={`${styles.dots} ${
        position === "top" ? styles.dotsTop : styles.dotsBottom
      }`}
    >
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

/* ---------- overlay ---------- */
const CustomizationOverlay = dynamic(
  () => import("../components/CustomizationOverlay"),
  { ssr: false }
);

/* ---------- swipe ---------- */
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

function Home() {
  const [plants, setPlants] = useState([]);
  const [pots, setPots] = useState([]);
  const [accessories, setAccessories] = useState([]);

  const [selectedPlantIndex, setSelectedPlantIndex] = useState(0);
  const [selectedPotIndex, setSelectedPotIndex] = useState(0);
  const [selectedPotVariant, setSelectedPotVariant] = useState(null);

  const [accIndex, setAccIndex] = useState(0);
  const [selectedAccessoryIndices, setSelectedAccessoryIndices] = useState([]);

  const [quantity, setQuantity] = useState(1);
  const [accPreview, setAccPreview] = useState({
    visible: false,
    x: 0,
    y: 0,
    html: "",
  });

  const [selectedColor, setSelectedColor] = useState(null);
  const [colorOptions, setColorOptions] = useState([]);

  const [editing, setEditing] = useState(false);
  const [activeSize, setActiveSize] = useState("Grande");

  const zoomRef = useRef(1);
  const sceneWrapRef = useRef(null);
  const stageRef = useRef(null);
  const plantScrollRef = useRef(null);
  const potScrollRef = useRef(null);
  const accScrollRef = useRef(null);
  const plantSwipeRef = useRef({ active: false, id: null, x: 0, y: 0 });
  const potSwipeRef = useRef({ active: false, id: null, x: 0, y: 0 });
  const editingRef = useRef(false);

  useEffect(() => {
    const onFlag = (e) => setEditing(!!e.detail?.editing);
    window.addEventListener("dobo-editing", onFlag);
    return () => window.removeEventListener("dobo-editing", onFlag);
  }, []);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);
  useEffect(() => {
    const s = stageRef.current;
    const c = sceneWrapRef.current;
    if (!s || !c) return;
    const ps = s.style.touchAction,
      pc = c.style.touchAction;
    s.style.touchAction = editing ? "none" : "pan-y";
    c.style.touchAction = editing ? "none" : "pan-y";
    return () => {
      s.style.touchAction = ps;
      c.style.touchAction = pc;
    };
  }, [editing]);

  /* ---------- fetch por tamaño y tipo ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rPots, rPlants, rAcc] = await Promise.all([
          fetch(
            `/api/products?size=${encodeURIComponent(activeSize)}&type=maceta&first=60`,
            { cache: "no-store" }
          ),
          fetch(
            `/api/products?size=${encodeURIComponent(activeSize)}&type=planta&first=60`,
            { cache: "no-store" }
          ),
          fetch(
            `/api/products?size=${encodeURIComponent(activeSize)}&type=accesorio&first=60`,
            { cache: "no-store" }
          ),
        ]);
        if (!rPots.ok) throw new Error(`pots HTTP ${rPots.status}`);
        if (!rPlants.ok) throw new Error(`plants HTTP ${rPlants.status}`);

        let accList = [];
        if (rAcc.ok) {
          const dAcc = await rAcc.json();
          accList = Array.isArray(dAcc) ? dAcc : dAcc.products || [];
          if (accList.length === 0) {
            const rAll = await fetch(`/api/products?type=accesorio&first=60`, {
              cache: "no-store",
            });
            if (rAll.ok) {
              const dAll = await rAll.json();
              accList = Array.isArray(dAll) ? dAll : dAll.products || [];
            }
          }
        }

        const dPots = await rPots.json();
        const dPlants = await rPlants.json();
        const potsList = Array.isArray(dPots) ? dPots : dPots.products || [];
        const plantsList = Array.isArray(dPlants) ? dPlants : dPlants.products || [];

        const norm = (list) =>
          list.map((p) => ({
            ...p,
            description:
              p?.description || p?.descriptionHtml || p?.body_html || "",
            descriptionHtml: p?.descriptionHtml || "",
            tags: Array.isArray(p?.tags) ? p.tags : [],
            variants: Array.isArray(p?.variants) ? p.variants : [],
            image:
              p?.image?.src ||
              p?.image ||
              (Array.isArray(p?.images) && p.images[0]?.src) ||
              "",
            minPrice: p?.minPrice || { amount: 0, currencyCode: "CLP" },
          }));

        if (cancelled) return;

        const potsSafe = norm(potsList);
        const plantsSafe = norm(plantsList);
        const accSafe = norm(accList);

        setPots(potsSafe);
        setPlants(plantsSafe);
        setAccessories(accSafe);

        if (potsSafe.length > 0) {
          const v =
            (potsSafe[0].variants || []).find((x) => x?.availableForSale) ||
            potsSafe[0].variants?.[0] ||
            null;
          setSelectedPotVariant(v || null);
        }
        setSelectedPotIndex(0);
        setSelectedPlantIndex(0);
        setAccIndex(0);
      } catch (err) {
        console.error("Error fetching products:", err);
        if (!cancelled) {
          setPlants([]);
          setPots([]);
          setAccessories([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSize]);

  /* ---------- sync tamaño por navegación de carrusel ---------- */
  useEffect(() => {
    const pot = pots[selectedPotIndex];
    const sz = pot ? getSizeTag(pot.tags) : "";
    if (sz && sz !== activeSize) setActiveSize(sz);
  }, [selectedPotIndex, pots]);
  useEffect(() => {
    const plant = plants[selectedPlantIndex];
    const sz = plant ? getSizeTag(plant.tags) : "";
    if (sz && sz !== activeSize) setActiveSize(sz);
  }, [selectedPlantIndex, plants]);

  /* ---------- bloquear carruseles en edición ---------- */
  useEffect(() => {
    [potScrollRef.current, plantScrollRef.current, accScrollRef.current].forEach(
      (el) => {
        if (!el) return;
        el.style.pointerEvents = editing ? "none" : "auto";
        el.style.touchAction = editing ? "none" : "pan-y";
      }
    );
  }, [editing]);

  /* ---------- zoom rueda ---------- */
  useEffect(() => {
    const container = sceneWrapRef.current,
      stage = stageRef.current;
    if (!container || !stage) return;
    zoomRef.current = zoomRef.current || 1;
    stage.style.setProperty("--zoom", String(zoomRef.current));
    const MIN = 0.8,
      MAX = 2.5;
    let target = zoomRef.current,
      raf = 0;
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

  /* ---------- variantes: solo color ---------- */
  useEffect(() => {
    const pot = pots[selectedPotIndex];
    if (!pot) {
      setColorOptions([]);
      setSelectedPotVariant(null);
      return;
    }
    const valid = (pot.variants || []).filter((v) => !!v.image);
    const lower = (s) => (s ?? "").toString().trim().toLowerCase();
    const colors = [
      ...new Set(
        valid.flatMap((v) =>
          (v.selectedOptions || [])
            .filter((o) => lower(o.name) === "color")
            .map((o) => o.value)
        )
      ),
    ];
    setColorOptions(colors);

    const match = (v, c) => {
      const opts = v.selectedOptions || [];
      return c
        ? opts.some(
            (o) => lower(o.name) === "color" && lower(o.value) === lower(c)
          )
        : true;
    };
    if (!(selectedColor && valid.some((v) => match(v, selectedColor)))) {
      const first = colors.find((c) => valid.some((v) => match(v, c)));
      if (first) setSelectedColor(first);
    }
    const chosen = valid.find((v) => match(v, selectedColor)) || valid[0] || null;
    setSelectedPotVariant(chosen || null);
  }, [pots, selectedPotIndex, selectedColor]);

  /* ---------- totales ---------- */
  const getTotalPrice = () => {
    const pot = pots[selectedPotIndex];
    const plant = plants[selectedPlantIndex];
    const potPrice = selectedPotVariant?.price
      ? num(selectedPotVariant.price)
      : firstVariantPrice(pot);
    const plantPrice = productMin(plant);
    const accTotal = selectedAccessoryIndices.reduce((s, i) => {
      const a = accessories[i];
      const v = a?.variants?.[0]?.price;
      return s + (v ? num(v) : productMin(a));
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
      const a = accessories[i];
      const base =
        a?.variants?.[0]?.compareAtPrice ??
        a?.variants?.[0]?.price ??
        a?.minPrice;
      return s + num(base);
    }, 0);
    return potCmp + plantCmp + accCmp;
  };

  /* ---------- ids ---------- */
  const gidToNumeric = (id) => {
    const s = String(id || "");
    return s.includes("gid://") ? s.split("/").pop() : s;
  };

  /* ---------- captura y cart ---------- */
  async function captureDesignPreview() {
    const el = stageRef?.current;
    if (!el) return null;
    const { default: html2canvas } = await import("html2canvas");
    const onclone = (doc) => {
      const st = doc.querySelector('[data-capture-stage="1"]') || doc.body;
      st.style.overflow = "visible";
      st.style.clipPath = "none";
      const prune = (sel, keep) => {
        const tr = doc.querySelector(sel);
        if (!tr) return;
        Array.from(tr.children).forEach((node, i) => {
          if (i !== keep) node.remove();
        });
        tr.style.transform = "none";
        tr.style.width = "100%";
      };
      prune('[data-capture="pot-track"]', selectedPotIndex);
      prune('[data-capture="plant-track"]', selectedPlantIndex);
      ['[data-capture="pot-container"]', '[data-capture="plant-container"]'].forEach(
        (sel) => {
          const c = doc.querySelector(sel);
          if (c) {
            c.style.overflow = "visible";
            c.style.clipPath = "none";
          }
        }
      );
    };
    const canvas = await html2canvas(el, {
      backgroundColor: "#eeeaeaff",
      scale: 3,
      useCORS: true,
      onclone,
    });
    return canvas.toDataURL("image/png");
  }
  async function prepareDesignAttributes() {
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
  function postCart(shop, mainVariantId, qty, attrs, accessoryIds, returnTo) {
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
    form.action = `https://um7xus-0u.myshopify.com/cart/add`;
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
      return (
        (attrs || []).find((a) => {
          const k = (a.key || "").toLowerCase();
          return k === n || k === `_${n}`;
        })?.value || ""
      );
    };
    const previewUrl = getA("DesignPreview"),
      designId = getA("DesignId"),
      designPlant = getA("DesignPlant"),
      designPot = getA("DesignPot"),
      designColor = getA("DesignColor"),
      designSize = getA("DesignSize");
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
  }
  const getAccessoryVariantIds = () =>
    selectedAccessoryIndices
      .map((i) => accessories[i]?.variants?.[0]?.id)
      .map(gidToNumeric)
      .filter((id) => /^\d+$/.test(id));
  async function buyNow() {
    try {
      const attrs = await prepareDesignAttributes();
      const potPrice = selectedPotVariant?.price
        ? num(selectedPotVariant.price)
        : firstVariantPrice(pots[selectedPotIndex]);
      const plantPrice = productMin(plants[selectedPlantIndex]);
      const basePrice = Number(((potPrice + plantPrice) * quantity).toFixed(2));
      const dpRes = await fetch("/api/design-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `DOBO ${plants[selectedPlantIndex]?.title} + ${pots[selectedPotIndex]?.title}`,
          previewUrl: attrs.find((a) => a.key === "_DesignPreview")?.value || "",
          price: basePrice,
          color: selectedColor || "Único",
          size: activeSize || "Único",
          designId: attrs.find((a) => a.key === "_DesignId")?.value,
          plantTitle: plants[selectedPlantIndex]?.title || "Planta",
          potTitle: pots[selectedPotIndex]?.title || "Maceta",
        }),
      });
      const dp = await dpRes.json();
      if (!dpRes.ok || !dp?.variantId) throw new Error(dp?.error || "No se creó el producto DOBO");
      const accIds = getAccessoryVariantIds();
      postCart("um7xus-0u.myshopify.com", dp.variantId, quantity, attrs, accIds, "/checkout");
    } catch (e) {
      alert(`No se pudo iniciar el checkout: ${e.message}`);
    }
  }
  async function addToCart() {
    try {
      const attrs = await prepareDesignAttributes();
      const potPrice = selectedPotVariant?.price
        ? num(selectedPotVariant.price)
        : firstVariantPrice(pots[selectedPotIndex]);
      const plantPrice = productMin(plants[selectedPlantIndex]);
      const basePrice = Number(((potPrice + plantPrice) * quantity).toFixed(2));
      const dpRes = await fetch("/api/design-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `DOBO ${plants[selectedPlantIndex]?.title} + ${pots[selectedPotIndex]?.title}`,
          previewUrl: attrs.find((a) => a.key === "_DesignPreview")?.value || "",
          price: basePrice,
          color: selectedColor || "Único",
          size: activeSize || "Único",
          designId: attrs.find((a) => a.key === "_DesignId")?.value,
          plantTitle: plants[selectedPlantIndex]?.title || "Planta",
          potTitle: pots[selectedPotIndex]?.title || "Maceta",
        }),
      });
      const dp = await dpRes.json();
      if (!dpRes.ok || !dp?.variantId) throw new Error(dp?.error || "No se creó el producto DOBO");
      const accIds = getAccessoryVariantIds();
      postCart("um7xus-0u.myshopify.com", dp.variantId, quantity, attrs, accIds, "/cart");
    } catch (e) {
      alert(`No se pudo añadir: ${e.message}`);
    }
  }

  /* ---------- handlers swipe ---------- */
  const createHandlers = (items, setIndex) => ({
    prev: () => setIndex((p) => (p > 0 ? p - 1 : Math.max(items.length - 1, 0))),
    next: () => setIndex((p) => (p < items.length - 1 ? p + 1 : 0)),
  });
  const plantHandlers = createHandlers(plants, setSelectedPlantIndex);
  const potHandlers = createHandlers(pots, setSelectedPotIndex);
  const plantSwipeEvents = makeSwipeEvents(plantSwipeRef, plantHandlers);
  const potSwipeEvents = makeSwipeEvents(potSwipeRef, potHandlers);

  /* ---------- UI ---------- */
  const baseCode = selectedPotVariant?.price?.currencyCode || "CLP";
  const totalNow = getTotalPrice() * quantity;
  const totalBase = getTotalComparePrice() * quantity;

  return (
    <div className={`container mt-5 ${styles.container}`} style={{ paddingBottom: "150px" }}>
      <div className="row justify-content-center align-items-start gx-5 gy-4">
        <div className="col-lg-5 col-md-8 col-12 text-center">

          {/* Selector de tamaño */}
          <div className="btn-group mb-3" role="group" aria-label="Tamaño">
            {["Pequeña", "Mediana", "Grande"].map((s) => (
              <button
                key={s}
                className={`btn btn-sm ${activeSize === s ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setActiveSize(s)}
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
              width: "500px",
              height: "650px",
              background: "linear-gradient(135deg, #f8f9fa 0%, #ebefe9ff 100%)",
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
            {/* Dots + flechas plantas */}
            <IndicatorDots
              count={plants.length}
              current={selectedPlantIndex}
              onSelect={(i) =>
                setSelectedPlantIndex(Math.max(0, Math.min(i, plants.length - 1)))
              }
              position="top"
            />
            <button
              className={`${styles.chev} ${styles.chevTopLeft}`}
              aria-label="Anterior planta"
              onClick={() =>
                setSelectedPlantIndex((p) => (p > 0 ? p - 1 : Math.max(plants.length - 1, 0)))
              }
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              className={`${styles.chev} ${styles.chevTopRight}`}
              aria-label="Siguiente planta"
              onClick={() =>
                setSelectedPlantIndex((p) => (p < plants.length - 1 ? p + 1 : 0))
              }
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>

            {/* Dots + flechas macetas */}
            <IndicatorDots
              count={pots.length}
              current={selectedPotIndex}
              onSelect={(i) =>
                setSelectedPotIndex(Math.max(0, Math.min(i, pots.length - 1)))
              }
              position="bottom"
            />
            <button
              className={`${styles.chev} ${styles.chevBottomLeft}`}
              aria-label="Anterior maceta"
              onClick={() =>
                setSelectedPotIndex((p) => (p > 0 ? p - 1 : Math.max(pots.length - 1, 0)))
              }
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              className={`${styles.chev} ${styles.chevBottomRight}`}
              aria-label="Siguiente maceta"
              onClick={() =>
                setSelectedPotIndex((p) => (p < pots.length - 1 ? p + 1 : 0))
              }
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>

            {/* Nodo escalado con carruseles */}
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
                {...potSwipeEvents}
              >
                <div
                  className={styles.carouselTrack}
                  data-capture="pot-track"
                  style={{ transform: `translateX(-${selectedPotIndex * 100}%)` }}
                >
                  {pots.map((product, idx) => {
                    const isSel = idx === selectedPotIndex;
                    const vImg = isSel
                      ? selectedPotVariant?.image || selectedPotVariant?.imageUrl || null
                      : null;
                    const imageUrl = vImg || product.image;
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

          {/* Carrusel accesorios */}
          {accessories.length > 0 && (
            <div className="mt-4 position-relative" style={{ width: "100%", maxWidth: 500, margin: "0 auto" }}>
              <IndicatorDots count={accessories.length} current={accIndex} onSelect={(i) => setAccIndex(i)} />
              <button
                className="btn btn-sm btn-outline-secondary"
                style={{ position: "absolute", left: 0, top: "45%", zIndex: 2 }}
                onClick={() => setAccIndex((i) => (i > 0 ? i - 1 : Math.max(accessories.length - 1, 0)))}
              >
                ‹
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                style={{ position: "absolute", right: 0, top: "45%", zIndex: 2 }}
                onClick={() => setAccIndex((i) => (i < accessories.length - 1 ? i + 1 : 0))}
              >
                ›
              </button>

              <div ref={accScrollRef} style={{ overflow: "hidden" }}>
                <div
                  style={{
                    display: "flex",
                    width: `${accessories.length * 100}%`,
                    transform: `translateX(-${(accIndex * 100) / accessories.length}%)`,
                    transition: "transform .3s ease",
                  }}
                >
                  {accessories.map((product, index) => {
                    const img =
                      product?.image ||
                      (Array.isArray(product?.images) && product.images[0]?.src) ||
                      "/placeholder.png";
                    const title = product?.title || product?.name || `Accesorio ${index + 1}`;
                    const selected = selectedAccessoryIndices.includes(index);
                    return (
                      <div key={product?.id || index} style={{ flex: "0 0 100%", padding: "0 24px" }}>
                        <div
                          onClick={(e) => {
                            const next = selected
                              ? selectedAccessoryIndices.filter((i) => i !== index)
                              : [...selectedAccessoryIndices, index];
                            setSelectedAccessoryIndices(next);
                            const cx = typeof e?.clientX === "number" ? e.clientX : 0,
                              cy = typeof e?.clientY === "number" ? e.clientY : 0;
                            setAccPreview({
                              visible: true,
                              x: cx + 16,
                              y: cy + 16,
                              html: buildIframeHTML(img, title, product?.description || ""),
                            });
                          }}
                          onMouseEnter={(e) => {
                            const cx = typeof e?.clientX === "number" ? e.clientX : 0,
                              cy = typeof e?.clientY === "number" ? e.clientY : 0;
                            setAccPreview({
                              visible: true,
                              x: cx + 16,
                              y: cy + 16,
                              html: buildIframeHTML(img, title, product?.description || ""),
                            });
                          }}
                          onMouseMove={(e) =>
                            setAccPreview((p) => (p.visible ? { ...p, x: e.clientX + 16, y: e.clientY + 16 } : p))
                          }
                          onMouseLeave={() => setAccPreview((p) => ({ ...p, visible: false }))}
                          style={{
                            border: selected ? "3px solid black" : "1px solid #ccc",
                            borderRadius: 12,
                            padding: 6,
                            cursor: "pointer",
                            width: "100%",
                            maxWidth: 420,
                            margin: "0 auto",
                          }}
                          aria-label={title}
                        >
                          <img
                            src={img}
                            alt={title}
                            style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 6 }}
                          />
                          <div className="mt-2 small text-muted">{title}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

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

              {colorOptions.length > 0 && (
                <div className="mb-4">
                  <h5>Color</h5>
                  <div className="d-flex justify-content-center gap-3 flex-wrap">
                    {colorOptions.map((color, index) => (
                      <div
                        key={index}
                        onClick={() => setSelectedColor(color)}
                        title={color}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          backgroundColor: "#ccc",
                          border: selectedColor === color ? "3px solid black" : "1px solid #ccc",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="d-flex flex-column align-items-center mb-5">
                <div className="mb-3 text-center">
                  <label className="form-label d-block">Cantidad</label>
                  <div className="input-group justify-content-center" style={{ maxWidth: 200, margin: "0 auto" }}>
                    <button className="btn btn-outline-secondary" onClick={() => setQuantity((p) => Math.max(1, p - 1))}>
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
                    <button className="btn btn-outline-secondary" onClick={() => setQuantity((p) => Math.min(1000, p + 1))}>
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

      <IframePreview
        visible={accPreview.visible}
        x={accPreview.x}
        y={accPreview.y}
        html={accPreview.html}
        onClose={() => setAccPreview((p) => ({ ...p, visible: false }))}
      />

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

export async function getServerSideProps() {
  return { props: {} };
}
export default dynamic(() => Promise.resolve(Home), { ssr: false });
