// features/home/HomePage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { cartCreateAndRedirect, toGid } from "../../lib/checkout";
import { getShopDomain } from "../../lib/shopDomain";

const CustomizationOverlay = dynamic(() => import("../../components/CustomizationOverlay"), { ssr: false });

// Utils
const money = (n, code="CLP") => new Intl.NumberFormat("es-CL", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(Number(n||0));
const num = (v) => Number(typeof v === "object" ? v?.amount : v || 0);
const firstVariantPrice = (p) => {
  const v = p?.variants?.[0]?.price;
  return v ? num(v) : num(p?.minPrice);
};
const productMin = (p) => num(p?.minPrice);

function EmptyState({ loadErr, onRetry }) {
  return (
    <div style={{ padding: 16, textAlign: "center", border: "1px dashed #aaa", borderRadius: 12, marginTop: 24 }}>
      <p style={{ marginBottom: 8 }}>
        {loadErr ? `No se pudieron cargar productos (${loadErr}).` : "Cargando productos…"}
      </p>
      <button className="btn btn-outline-secondary" onClick={onRetry}>Reintentar</button>
      <p className="mt-2" style={{ fontSize: 12, color: "#666" }}>
        Revisa que <code>/pages/api/products.js</code> responda 200 y que tu tienda tenga productos de tipo “maceta” y “planta”.
      </p>
    </div>
  );
}

export default function HomePage() {
  const [activeSize, setActiveSize] = useState("Mediano");
  const [plants, setPlants] = useState([]);
  const [pots, setPots] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [selectedPlantIndex, setSelectedPlantIndex] = useState(0);
  const [selectedPotIndex, setSelectedPotIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loadErr, setLoadErr] = useState(null);

  const selectedProduct = pots[selectedPotIndex] || null;

  const baseCode = selectedVariant?.price?.currencyCode || "CLP";
  const totalNow = useMemo(() => {
    const pot = pots[selectedPotIndex];
    const plant = plants[selectedPlantIndex];
    const potPrice = selectedVariant?.price ? num(selectedVariant.price) : firstVariantPrice(pot);
    const plantPrice = productMin(plant);
    return (potPrice + plantPrice) * quantity;
  }, [pots, plants, selectedPotIndex, selectedPlantIndex, quantity, selectedVariant]);

  const refetchProducts = useCallback(async () => {
    setLoadErr(null);
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
      const dAcc = rAcc.ok ? await rAcc.json() : { products: [] };

      const norm = (list) =>
        (Array.isArray(list) ? list : list?.products || []).map((p) => ({
          ...p,
          description: p?.description || p?.descriptionHtml || "",
          descriptionHtml: p?.descriptionHtml || "",
          tags: Array.isArray(p?.tags) ? p.tags : [],
          variants: Array.isArray(p?.variants) ? p.variants : [],
          image: p?.image || "",
          minPrice: p?.minPrice || { amount: 0, currencyCode: "CLP" },
        }));

      const potsSafe = norm(dPots);
      const plantsSafe = norm(dPlants);
      const accSafe = norm(dAcc);

      setPots(potsSafe);
      setPlants(plantsSafe);
      setAccessories(accSafe);

      setSelectedPotIndex(0);
      setSelectedPlantIndex(0);
      setSelectedVariant(potsSafe?.[0]?.variants?.[0] || null);
    } catch (err) {
      console.error("Error fetching products:", err);
      setLoadErr(err instanceof Error ? err.message : String(err));
      setPots([]);
      setPlants([]);
      setAccessories([]);
    }
  }, [activeSize]);

  useEffect(() => { refetchProducts(); }, [refetchProducts]);

  useEffect(() => {
    const pot = pots[selectedPotIndex];
    setSelectedVariant(pot?.variants?.[0] || null);
  }, [pots, selectedPotIndex]);

  async function buyNow() {
    try {
      const mainVariantId =
        selectedVariant?.id ||
        pots?.[selectedPotIndex]?.variants?.[0]?.id ||
        null;
      if (!mainVariantId) throw new Error("variant-missing");

      const lines = [
        {
          merchandiseId: toGid(mainVariantId),
          quantity: quantity || 1,
          attributes: [
            { key: "_LinePriority", value: "0" },
            { key: "_DesignSize", value: activeSize },
          ],
        },
      ];

      await cartCreateAndRedirect(lines);
    } catch (e) {
      alert(`No se pudo iniciar el checkout: ${e?.message || e}`);
    }
  }

  return (
    <div className="container py-4">
      <h1 className="h3 mb-3">DOBO</h1>

      <div className="mb-3">
        <div className="btn-group" role="group" aria-label="Tamaño">
          {["Pequeño", "Mediano", "Grande"].map((s) => (
            <button
              key={s}
              className={`btn btn-sm ${activeSize === s ? "btn-dark" : "btn-outline-secondary"}`}
              onClick={() => setActiveSize(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {(pots.length > 0 && plants.length > 0) ? (
        <div className="row g-4 align-items-start">
          <div className="col-md-6">
            <div className="mb-3">
              <label className="form-label">Maceta</label>
              <select
                className="form-select"
                value={String(selectedPotIndex)}
                onChange={(e) => setSelectedPotIndex(Number(e.target.value))}
              >
                {pots.map((p, i) => (
                  <option key={p.id || i} value={i}>{p.title}</option>
                ))}
              </select>
              {selectedProduct?.image && (
                <img
                  src={selectedProduct.image}
                  alt={selectedProduct?.title || "Maceta"}
                  style={{ maxWidth: "100%", borderRadius: 8, marginTop: 8 }}
                />
              )}
            </div>

            <div className="mb-3">
              <label className="form-label">Planta</label>
              <select
                className="form-select"
                value={String(selectedPlantIndex)}
                onChange={(e) => setSelectedPlantIndex(Number(e.target.value))}
              >
                {plants.map((p, i) => (
                  <option key={p.id || i} value={i}>{p.title}</option>
                ))}
              </select>
              {plants[selectedPlantIndex]?.image && (
                <img
                  src={plants[selectedPlantIndex].image}
                  alt={plants[selectedPlantIndex]?.title || "Planta"}
                  style={{ maxWidth: "100%", borderRadius: 8, marginTop: 8 }}
                />
              )}
            </div>
          </div>

          <div className="col-md-6">
            <div className="d-flex justify-content-center align-items-baseline gap-3 mb-3">
              <span className="display-6">{money(totalNow, baseCode)}</span>
            </div>

            <div className="mb-3">
              <label className="form-label d-block">Cantidad</label>
              <div className="input-group" style={{ maxWidth: 240 }}>
                <button className="btn btn-outline-secondary" onClick={() => setQuantity((p) => Math.max(1, p - 1))}>-</button>
                <input
                  type="number"
                  className="form-control text-center"
                  value={quantity}
                  min={1}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!Number.isFinite(n) || n < 1) setQuantity(1);
                    else setQuantity(Math.min(n, 999));
                  }}
                />
                <button className="btn btn-outline-secondary" onClick={() => setQuantity((p) => Math.min(999, p + 1))}>+</button>
              </div>
            </div>

            <div className="d-flex gap-3">
              <button className="btn btn-dark px-4 py-2" onClick={buyNow}>Comprar ahora</button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState loadErr={loadErr} onRetry={refetchProducts} />
      )}

      {/* Overlay queda montado para tu editor basado en Fabric si existe */}
      <div className="mt-4">
        <CustomizationOverlay mode="both" />
      </div>
    </div>
  );
}