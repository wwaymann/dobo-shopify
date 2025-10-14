// features/home/HomePage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import styles from "../../styles/home.module.css";
import { cartCreateAndRedirect, toGid, postCart } from "../../lib/checkout";
import { getShopDomain } from "../../lib/shopDomain";

const CustomizationOverlay = dynamic(() => import("../../components/CustomizationOverlay"), { ssr: false });

const money = (amount, currency = "CLP") =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount || 0));
const num = (v) => Number(typeof v === "object" ? v?.amount : v || 0);
const firstVariantPrice = (p) => {
  const v = p?.variants?.[0]?.price;
  return v ? num(v) : num(p?.minPrice);
};
const productMin = (p) => num(p?.minPrice);

export default function HomePage() {
  // dominio seguro (evitar SHOP_DOMAIN global y TDZ)
  const [shopDomain, setShopDomain] = useState(getShopDomain());

  const [plants, setPlants] = useState([]);
  const [pots, setPots] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [selectedPlantIndex, setSelectedPlantIndex] = useState(0);
  const [selectedPotIndex, setSelectedPotIndex] = useState(0);
  const [selectedPotVariant, setSelectedPotVariant] = useState(null);
  const [selectedColor, setSelectedColor] = useState("Cemento");
  const [activeSize, setActiveSize] = useState("Mediano");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setShopDomain(getShopDomain());
  }, []);

  // cargar productos
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
        const dPots = rPots.ok ? await rPots.json() : [];
        const dPlants = rPlants.ok ? await rPlants.json() : [];
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
        setPots(norm(dPots));
        setPlants(norm(dPlants));
        setAccessories(norm(dAcc));
      } catch (e) {
        if (!cancelled) { setPlants([]); setPots([]); setAccessories([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [activeSize]);

  // pot variant derivada por color
  useEffect(() => {
    const pot = pots[selectedPotIndex];
    if (!pot) { setSelectedPotVariant(null); return; }
    const valid = (pot.variants || []).filter((v) => !!v.image);
    const lower = (s) => (s ?? "").toString().trim().toLowerCase();
    const match = (v, c) => {
      const opts = v.selectedOptions || [];
      return c ? opts.some((o) => lower(o.name) === "color" && lower(o.value) === lower(c)) : true;
    };
    const chosen = valid.find((v) => match(v, selectedColor)) || valid[0] || null;
    setSelectedPotVariant(chosen || null);
  }, [pots, selectedPotIndex, selectedColor]);

  const baseCode = selectedPotVariant?.price?.currencyCode || "CLP";
  const totalNow = useMemo(() => {
    const pot = pots[selectedPotIndex];
    const plant = plants[selectedPlantIndex];
    const potPrice = selectedPotVariant?.price ? num(selectedPotVariant.price) : firstVariantPrice(pot);
    const plantPrice = productMin(plant);
    return (potPrice + plantPrice) * quantity;
  }, [pots, plants, selectedPotIndex, selectedPlantIndex, quantity, selectedPotVariant]);

  // --- helpers de atributos DOBO (resumen corto) ---
  function buildShortAttributes() {
    const pot = pots[selectedPotIndex];
    const plant = plants[selectedPlantIndex];
    const title = `DOBO ${plant?.title || ""} + ${pot?.title || ""}`.trim();
    const id = `dobo-${Date.now()}`;
    return [
      { key: "_DesignId", value: id },
      { key: "_DesignName", value: title },
      { key: "_DesignColor", value: selectedColor || "" },
      { key: "_DesignSize", value: activeSize || "" },
      { key: "_LinePriority", value: "0" },
      // descripción super corta para checkout/cart
      { key: "Descripción", value: `${title} · Color: ${selectedColor || "Único"} · Tamaño: ${activeSize || "Único"}` },
    ];
  }

  function getAccessoryVariantIds() {
    return []; // si tienes accesorios seleccionados, mapea sus variantId aquí
  }

  // --- flujo Comprar Ahora (cartCreate -> redirect) ---
  async function buyNow() {
    try {
      const pot = pots[selectedPotIndex];
      const plant = plants[selectedPlantIndex];
      const variantId = selectedPotVariant?.id || pot?.variants?.[0]?.id;
      if (!variantId) throw new Error("variant-missing");

      // Opcional: crear producto DOBO por API Admin (no bloquea checkout).
      let createRes = null;
      try {
        const attrs = buildShortAttributes();
        const resp = await fetch("/api/design-product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: attrs.find(a => a.key === "_DesignName")?.value,
            previewUrl: "", // si luego agregas html2canvas, pásalo aquí
            price: Number(totalNow.toFixed(0)),
            color: selectedColor,
            size: activeSize,
            designId: attrs.find(a => a.key === "_DesignId")?.value,
            plantTitle: plant?.title,
            potTitle: pot?.title,
          }),
        });
        createRes = await resp.json().catch(() => null);
      } catch (e) {
        console.warn("design-product failed (non-blocking):", e);
      }

      const doboVariant = createRes?.variantId || variantId;
      const attrs = buildShortAttributes();

      const lines = [
        {
          merchandiseId: toGid(doboVariant),
          quantity: quantity,
          attributes: attrs.map(a => ({ key: a.key, value: String(a.value || "") })),
        },
        // accesorios (1 c/u)
        ...getAccessoryVariantIds().map((id) => ({
          merchandiseId: toGid(id),
          quantity: 1,
          attributes: [{ key: "_Accessory", value: "true" }],
        })),
      ];

      await cartCreateAndRedirect(lines);
    } catch (e) {
      alert(`No se pudo iniciar el checkout: ${e?.message || e}`);
    }
  }

  return (
    <div className={`container mt-lg-3 mt-0 ${styles.container}`} style={{ paddingBottom: "150px" }}>
      <div className="row justify-content-center align-items-start gx-5 gy-4">
        <div className="col-lg-5 col-md-8 col-12 text-center">
          <div className="btn-group mb-3" role="group" aria-label="Tamaño">
            {["Pequeño", "Mediano", "Grande"].map((s) => (
              <button key={s} className={`btn btn-sm ${activeSize === s ? "btn-dark" : "btn-outline-secondary"}`} onClick={() => setActiveSize(s)}>
                {s}
              </button>
            ))}
          </div>

          <div className="mb-3" style={{ border: "2px dashed #999", borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>
              <strong>Total</strong> <span style={{ fontSize: 28 }}>{money(totalNow, baseCode)}</span>
            </div>
            <div className="d-flex justify-content-center gap-3">
              <button className="btn btn-outline-dark px-4 py-2" onClick={buyNow}>Comprar ahora</button>
            </div>
          </div>
        </div>

        <CustomizationOverlay mode="both" />
      </div>
    </div>
  );
}
