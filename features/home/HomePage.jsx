// features/home/HomePage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "bootstrap/dist/css/bootstrap.min.css";
import styles from "../../styles/home.module.css";
import { cartCreateAndRedirect, toGid } from "../../lib/checkout";

const CustomizationOverlay = dynamic(
  () => import("../../components/CustomizationOverlay"),
  { ssr: false, loading: () => null }
);

const peso = (v, code = "CLP") =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(Number(v || 0));

const num = (v) => Number(typeof v === "object" ? v?.amount : v || 0);
const firstVariantPrice = (p) => {
  const v = p?.variants?.[0]?.price;
  return v ? num(v) : num(p?.minPrice);
};
const productMin = (p) => num(p?.minPrice);

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

const toLineAttributes = (attrs = []) =>
  (attrs || []).map((a) => ({
    key: String(a.key || "").replace(/^_+/, ""),
    value: String(a.value ?? ""),
  }));

async function capturePreview(el) {
  try {
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      onclone: (doc) => {
        const s = doc.querySelector('[data-capture-stage="1"]') || doc.body;
        s.style.overflow = "visible";
        s.style.clipPath = "none";
      },
      willReadFrequently: true,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

export default function HomePage() {
  const [activeSize, setActiveSize] = useState("Mediano");
  const [selectedColor, setSelectedColor] = useState("Cemento");
  const [quantity, setQuantity] = useState(1);

  const [plants, setPlants] = useState([]);
  const [pots, setPots] = useState([]);
  const [accessories, setAccessories] = useState([]);

  const [selectedPlantIndex, setSelectedPlantIndex] = useState(0);
  const [selectedPotIndex, setSelectedPotIndex] = useState(0);
  const [selectedPotVariant, setSelectedPotVariant] = useState(null);

  const stageRef = useRef(null);
  const potScrollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = encodeURIComponent(activeSize);
        const [rPots, rPlants, rAcc] = await Promise.all([
          fetch(`/api/products?size=${q}&type=maceta&first=50`, { cache: "no-store" }),
          fetch(`/api/products?size=${q}&type=planta&first=50`, { cache: "no-store" }),
          fetch(`/api/products?type=accesorio&first=60`, { cache: "no-store" }),
        ]);
        const dPots = rPots.ok ? await rPots.json() : { products: [] };
        const dPlants = rPlants.ok ? await rPlants.json() : { products: [] };
        const dAcc = rAcc.ok ? await rAcc.json() : { products: [] };
        const norm = (list) =>
          (Array.isArray(list) ? list : list?.products || []).map((p) => ({
            ...p,
            description: p?.description || p?.descriptionHtml || p?.body_html || "",
            descriptionHtml: p?.descriptionHtml || "",
            variants: Array.isArray(p?.variants) ? p.variants : [],
            image:
              p?.image?.src ||
              p?.image ||
              (Array.isArray(p?.images) && p.images[0]?.src) ||
              "",
            minPrice: p?.minPrice || { amount: 0, currencyCode: "CLP" },
          }));
        if (!cancelled) {
          const potsSafe = norm(dPots);
          const plantsSafe = norm(dPlants);
          const accSafe = norm(dAcc);
          setPots(potsSafe);
          setPlants(plantsSafe);
          setAccessories(accSafe);
          setSelectedPotIndex((i) => Math.min(i, Math.max(0, potsSafe.length - 1)));
          setSelectedPlantIndex((i) => Math.min(i, Math.max(0, plantsSafe.length - 1)));
        }
      } catch (e) {
        if (!cancelled) {
          setPots([]); setPlants([]); setAccessories([]);
        }
      }
    })();
    return () => { cancelled = true; }
  }, [activeSize]);

  useEffect(() => {
    const pot = pots[selectedPotIndex];
    if (!pot) { setSelectedPotVariant(null); return; }
    const valid = (pot.variants || []).filter((v) => !!(v.image || v.imageUrl));
    const lower = (s) => (s ?? "").toString().trim().toLowerCase();
    const matchColor = (v, c) => {
      const opts = v.selectedOptions || [];
      return c ? opts.some((o) => lower(o.name) === "color" && lower(o.value) === lower(c)) : true;
    };
    const chosen = valid.find((v) => matchColor(v, selectedColor)) || valid[0] || null;
    setSelectedPotVariant(chosen || null);
  }, [pots, selectedPotIndex, selectedColor]);

  const selectedProduct = pots[selectedPotIndex] || {};
  const selectedVariant = useMemo(() => selectedPotVariant || selectedProduct?.variants?.[0] || null, [selectedPotVariant, selectedProduct]);

  const totalNow = useMemo(() => {
    const pot = pots[selectedPotIndex];
    const plant = plants[selectedPlantIndex];
    const potPrice = selectedVariant?.price ? num(selectedVariant.price) : firstVariantPrice(pot);
    const plantPrice = productMin(plant);
    const accTotal = 0;
    return (potPrice + plantPrice + accTotal) * quantity;
  }, [pots, plants, selectedPotIndex, selectedPlantIndex, quantity, selectedVariant]);

  async function buyNow() {
    try {
      let attrs = [];
      let previewUrl = "";
      const stage = stageRef.current;
      if (stage) previewUrl = await capturePreview(stage);
      const designId = `dobo-${Date.now()}`;
      attrs = [
        { key: "DesignId", value: designId },
        { key: "DesignPreview", value: previewUrl },
        { key: "DesignColor", value: selectedColor || "" },
        { key: "DesignSize", value: activeSize || "" },
      ];
      const potPrice = selectedVariant?.price ? num(selectedVariant.price) : firstVariantPrice(pots[selectedPotIndex]);
      const plantPrice = productMin(plants[selectedPlantIndex]);
      const basePrice = Number(((potPrice + plantPrice) * quantity).toFixed(2));
      let dp = null;
      try {
        const resp = await fetch("/api/design-product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `DOBO ${plants[selectedPlantIndex]?.title} + ${pots[selectedPotIndex]?.title}`,
            previewUrl,
            price: basePrice,
            color: selectedColor || "Único",
            size: activeSize || "Único",
            designId,
            plantTitle: plants[selectedPlantIndex]?.title || "Planta",
            potTitle: pots[selectedPotIndex]?.title || "Maceta",
          }),
        });
        dp = await resp.json().catch(() => null);
        if (!resp.ok || !dp?.variantId) dp = null;
      } catch { dp = null; }
      let mainVariantId = dp?.variantId || selectedVariant?.id || pots?.[selectedPotIndex]?.variants?.[0]?.id;
      if (!mainVariantId) throw new Error("variant-missing");
      const lines = [
        { merchandiseId: toGid(mainVariantId), quantity, attributes: toLineAttributes(attrs) },
      ];
      await cartCreateAndRedirect(lines);
    } catch (e) {
      alert(`No se pudo iniciar el checkout: ${e?.message || e}`);
    }
  }

  const baseCode = selectedVariant?.price?.currencyCode || "CLP";
  return (
    <div className={`container mt-lg-3 mt-0 ${styles.container}`} style={{ paddingBottom: "120px" }}>
      <div className="row justify-content-center align-items-start gx-5 gy-4">
        <div className="col-lg-5 col-md-8 col-12 text-center">
          <div className="btn-group mb-3" role="group" aria-label="Tamaño">
            {["Pequeño", "Mediano", "Grande"].map((s) => (
              <button key={s} className={`btn btn-sm ${activeSize === s ? "btn-dark" : "btn-outline-secondary"}`} onClick={() => setActiveSize(s)}>
                {s}
              </button>
            ))}
          </div>
          <div
            className="position-relative"
            ref={stageRef}
            data-capture-stage="1"
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
              userSelect: "none",
            }}
          >
            <IndicatorDots count={plants.length} current={selectedPlantIndex} onSelect={(i) => setSelectedPlantIndex(Math.max(0, Math.min(i, plants.length - 1)))} position="top" />
            <div className={styles.carouselContainer} ref={potScrollRef} style={{ zIndex: 1, touchAction: "pan-y", userSelect: "none" }}>
              <div className={styles.carouselTrack} style={{ transform: `translateX(-${selectedPotIndex * 100}%)` }}>
                {pots.map((product, idx) => {
                  const isSel = idx === selectedPotIndex;
                  const vImg = isSel ? selectedPotVariant?.image || selectedPotVariant?.imageUrl || null : null;
                  const imageUrl = vImg || product.image || "/placeholder.png";
                  return (
                    <div key={product.id || idx} className={styles.carouselItem}>
                      <img src={imageUrl} alt={product.title || "maceta"} className={styles.carouselImage} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div
              className={styles.carouselContainer}
              style={{ zIndex: 2, position: "absolute", bottom: "300px", height: "530px", left: "50%", transform: "translateX(-50%)", touchAction: "pan-y", userSelect: "none" }}
            >
              <div className={styles.carouselTrack} style={{ transform: `translateX(-${selectedPlantIndex * 100}%)` }}>
                {plants.map((product, idx) => (
                  <div key={product.id || idx} className={styles.carouselItem}>
                    <img src={product.image || "/placeholder.png"} alt={product.title || "planta"} className={`${styles.carouselImage} ${styles.plantImageOverlay}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div id="dobo-menu-dock" className={styles.menuDock} />
        </div>
        <CustomizationOverlay mode="both" stageRef={stageRef} anchorRef={potScrollRef} containerRef={stageRef} docked={false} />
        <div className="col-lg-5 col-md-8 col-12">
          {(pots.length > 0 && plants.length > 0) ? (
            <div className="text-center">
              <div className="d-flex justify-content-center align-items-baseline gap-3 mb-4" style={{ marginTop: 20 }}>
                <span style={{ fontWeight: "bold", fontSize: "3rem" }}>{peso(totalNow, baseCode)}</span>
              </div>
              {selectedVariant?.selectedOptions?.length ? (
                <div className="mb-4">
                  <h5>Color</h5>
                  <div className="d-flex justify-content-center gap-3 flex-wrap">
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedColor("Cemento")}>Cemento</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedColor("Blanco")}>Blanco</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedColor("Negro")}>Negro</button>
                  </div>
                </div>
              ) : null}
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
                        if (isNaN(n) || n < 1) return setQuantity(1);
                        setQuantity(Math.min(1000, n));
                      }}
                    />
                    <button className="btn btn-outline-secondary" onClick={() => setQuantity((p) => Math.min(1000, p + 1))}>+</button>
                  </div>
                  <div className="d-flex gap-3 mt-3">
                    <button className="btn btn-dark px-4 py-2" onClick={buyNow}>Comprar ahora</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center mt-5">Cargando catálogo…</p>
          )}
        </div>
      </div>
    </div>
  );
}
