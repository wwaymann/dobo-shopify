import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import styles from "../../styles/home.module.css";

import { cartCreateAndRedirect, toGid } from "../../lib/checkout";
import { getShopDomain } from "../../lib/shopDomain";

// ---------------- Email fire-and-forget (iframe-safe) ----------------
function sendEmailNow(payload) {
  try {
    const url = new URL("/api/send-design-email", location.origin).toString();
    const json = JSON.stringify(payload);

    if (navigator.sendBeacon && json.length < 64000) {
      const blob = new Blob([json], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
      keepalive: true,
    })
      .then((r) => r.json())
      .then((r) => { if (!r?.ok) console.warn("email api responded not ok", r); })
      .catch((err) => console.warn("email api error", err));
  } catch (e) {
    console.warn("sendEmailNow failed", e);
  }
}

// Filtra attrs pesados: fuera data:base64 y claves raras; sólo URLs cortas
function shrinkAttrsForEmail(attrs) {
  const SAFE = [];
  for (const a of Array.isArray(attrs) ? attrs : []) {
    const key = String(a?.key || "").trim();
    const val = String(a?.value ?? "");
    if (!key) continue;

    // descarta dataURI/base64 y valores gigantes
    if (/^data:/i.test(val)) continue;
    if (val.length > 1500) continue;

    // deja URLs http/https y campos cortos (DesignId, Color, Size…)
    if (/^https?:\/\//i.test(val) || key.toLowerCase().startsWith("design") || key.startsWith("_")) {
      SAFE.push({ key, value: val });
    }
  }
  // limite duro por si acaso
  return SAFE.slice(0, 30);
}

// ---------------- (opcional) /cart/add por form ----------------
function postCart(shopDomain, primaryVariantId, qty, attributes = [], accessoryVariantIds = [], redirectPath = "/checkout") {
  const shop = String(shopDomain || "").trim();
  if (!shop || /vercel\.(app|com)$/i.test(shop)) {
    alert("dominio de tienda inválido");
    return;
  }
  const normalizeId = (id) => String(id || "").replace(/^gid:\/\/shopify\/ProductVariant\//, "").replace(/\D/g, "");
  const lines = [];
  const pushLine = (id, q = 1, propsArr = []) => {
    const properties = {};
    (Array.isArray(propsArr) ? propsArr : []).forEach((a) => {
      const k = String(a?.key || "").trim();
      if (!k) return;
      properties[k] = String(a?.value ?? "");
    });
    lines.push({ id: normalizeId(id), quantity: Number(q) || 1, properties });
  };
  pushLine(primaryVariantId, qty, attributes);
  (accessoryVariantIds || []).forEach((acc) => pushLine(acc, 1, []));

  const form = document.createElement("form");
  form.method = "POST";
  form.action = `https://${shop}/cart/add`;
  form.target = "_top";

  lines.forEach((ln, idx) => {
    const inId = document.createElement("input");
    inId.name = `items[${idx}][id]`;
    inId.value = ln.id;
    form.appendChild(inId);

    const inQty = document.createElement("input");
    inQty.name = `items[${idx}][quantity]`;
    inQty.value = String(ln.quantity);
    form.appendChild(inQty);

    Object.entries(ln.properties).forEach(([k, v]) => {
      const ip = document.createElement("input");
      ip.name = `items[${idx}][properties][${k}]`;
      ip.value = v;
      form.appendChild(ip);
    });
  });

  const ret = document.createElement("input");
  ret.type = "hidden";
  ret.name = "return_to";
  ret.value = redirectPath === "/checkout" ? "/checkout" : String(redirectPath || "/checkout");
  form.appendChild(ret);

  document.body.appendChild(form);
  form.submit();
}

// ---------------- UI helpers ----------------
const CustomizationOverlay = dynamic(() => import("../../components/CustomizationOverlay"), { ssr: false });

const money = (v, code = "CLP") =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(Number(v || 0));
const num = (v) => Number(typeof v === "object" ? v?.amount : v || 0);

function sendEmailNow(payload) {
  try {
    const url = "/api/send-design-email";
    const json = JSON.stringify(payload);

    // 1) Preferir Beacon si pesan poco (<~64KB)
    if (navigator.sendBeacon && json.length < 64000) {
      const blob = new Blob([json], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
    // 2) Fallback keepalive (no bloquear)
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
      keepalive: true,
    }).catch(()=>{});
  } catch (e) {
    console.warn("sendEmailNow failed", e);
  }
}

function findAttr(attrs, name) {
  const n = String(name || "").toLowerCase();
  const it = (attrs || []).find(a => String(a?.key || "").toLowerCase() === n);
  return it?.value || "";
}


export default function HomePage() {
  const [activeSize, setActiveSize] = useState("Mediano");
  const [plants, setPlants] = useState([]);
  const [pots, setPots] = useState([]);
  const [accessories, setAccessories] = useState([]);

  const [selectedPlantIndex, setSelectedPlantIndex] = useState(0);
  const [selectedPotIndex, setSelectedPotIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState("Cemento");
  const [quantity, setQuantity] = useState(1);
  const [colorOptions, setColorOptions] = useState([]);

  const sceneWrapRef = useRef(null);
  const stageRef = useRef(null);

  useEffect(() => {
    let done = false;
    (async () => {
      try {
        const sizeQ = encodeURIComponent(activeSize);
        const [rPots, rPlants, rAcc] = await Promise.all([
          fetch(`/api/products?size=${sizeQ}&type=maceta&first=40`, { cache: "no-store" }).catch(() => null),
          fetch(`/api/products?size=${sizeQ}&type=planta&first=40`, { cache: "no-store" }).catch(() => null),
          fetch(`/api/products?type=accesorio&first=40`, { cache: "no-store" }).catch(() => null),
        ]);
        const jsonSafe = async (r) => (r && r.ok ? await r.json() : null);
        const potsJ = (await jsonSafe(rPots)) || {};
        const plantsJ = (await jsonSafe(rPlants)) || {};
        const accJ = (await jsonSafe(rAcc)) || {};

        const norm = (list) =>
          (Array.isArray(list) ? list : list?.products || []).map((p) => ({
            id: p.id || p.handle || p.title,
            title: p.title || p.name || "Producto",
            handle: p.handle || "",
            image: p?.image?.src || p?.image || (Array.isArray(p?.images) && p.images[0]?.src) || "/placeholder.png",
            description: p?.description || p?.body_html || "",
            descriptionHtml: p?.descriptionHtml || "",
            variants: Array.isArray(p?.variants) ? p.variants : [],
            minPrice: p?.minPrice || { amount: 0, currencyCode: "CLP" },
            tags: Array.isArray(p?.tags) ? p.tags : [],
          }));

        if (done) return;
        setPots(norm(potsJ));
        setPlants(norm(plantsJ));
        setAccessories(norm(accJ));
      } catch (e) {
        console.warn("fetch products failed; using placeholders", e);
        if (!done) {
          setPots([{ id: "p1", title: "Maceta", image: "/placeholder.png", variants: [{ id: "1", price: 10000 }] }]);
          setPlants([{ id: "pl1", title: "Planta", image: "/placeholder.png", minPrice: 5000 }]);
          setAccessories([]);
        }
      }
    })();
    return () => { done = true; };
  }, [activeSize]);

  const selectedVariant = useMemo(() => {
    const pot = pots[selectedPotIndex];
    if (!pot) return null;
    const lower = (s) => (s ?? "").toString().trim().toLowerCase();
    const valid = (pot.variants || []).filter((v) => !!(v.image || v.imageId || v.imageUrl || v.image_id));
    const colors = [...new Set(valid.flatMap((v) => (v.selectedOptions || []).filter((o) => lower(o.name) === "color").map((o) => o.value)))];
    if (colors.length && !colors.includes(selectedColor)) setSelectedColor(colors[0]);
    const match = (v, c) => (v.selectedOptions || []).some((o) => lower(o.name) === "color" && lower(o.value) === lower(c));
    return valid.find((v) => match(v, selectedColor)) || valid[0] || pot.variants?.[0] || null;
  }, [pots, selectedPotIndex, selectedColor]);

  useEffect(() => {
    const pot = pots[selectedPotIndex];
    if (!pot) return setColorOptions([]);
    const lower = (s) => (s ?? "").toString().trim().toLowerCase();
    const valid = (pot.variants || []).filter((v) => !!(v.image || v.imageId || v.imageUrl || v.image_id));
    const colors = [...new Set(valid.flatMap((v) => (v.selectedOptions || []).filter((o) => lower(o.name) === "color").map((o) => o.value)))];
    setColorOptions(colors);
  }, [pots, selectedPotIndex]);

  const totalNow = useMemo(() => {
    const potPrice = selectedVariant?.price ? num(selectedVariant.price) : 0;
    const plantPrice = num(plants[selectedPlantIndex]?.minPrice);
    return (potPrice + plantPrice) * quantity;
  }, [selectedVariant, plants, selectedPlantIndex, quantity]);

  async function minimalDesignAttributes() {
    return [
      { key: "DesignId", value: `dobo-${Date.now()}` },
      { key: "DesignColor", value: selectedColor || "" },
      { key: "DesignSize", value: activeSize || "" },
    ];
  }

  // ---------------- Comprar ahora ----------------
  async function buyNow() {
    try {
      // 1) Atributos (usa tu helper si existe)
      let attrs = [];
      if (typeof window.buildAndSaveDesignForCartCheckout === "function") {
        const r = await window.buildAndSaveDesignForCartCheckout();
        attrs = Array.isArray(r?.attributes) ? r.attributes : [];
      } else if (typeof window.prepareDesignAttributes === "function") {
        attrs = await window.prepareDesignAttributes();
      } else {
        attrs = await minimalDesignAttributes();
      }

      // 2) Precio y descripción corta
      const potPrice = selectedVariant?.price ? num(selectedVariant.price) : 0;
      const plantPrice = num(plants?.[selectedPlantIndex]?.minPrice);
      const basePrice = Math.max(0, Number(((potPrice + plantPrice) * quantity).toFixed(2)));
      const shortDescription = (
        `DOBO ${plants?.[selectedPlantIndex]?.title ?? ""} + ` +
        `${pots?.[selectedPotIndex]?.title ?? ""} · ` +
        `${activeSize ?? ""} · ${selectedColor ?? ""}`
      ).replace(/\s+/g, " ").trim();

      // 3) Disparar email con payload pequeño
      const thinAttrs = shrinkAttrsForEmail(attrs);
      sendEmailNow({
        attrs: thinAttrs,
        meta: { Descripcion: shortDescription, Precio: basePrice },
        links: { Storefront: location.origin },  // añade más si quieres
        attachPreviews: true,                     // el server decide si adjunta
      });

      // ...dentro de buyNow(), cuando ya tengas `attrs`, `shortDescription`, `basePrice`:
const preview =
  attrs.find(a => (a.key||"").toLowerCase().includes("designpreview"))?.value || "";

sendEmailNow({
  attachPreviews: true,         // adjunta DesignPreview
  // attachAll: true,           // si quieres adjuntar TODAS las capas con URL
  attrs,                        // aquí pueden venir tus Layer:Base, Layer:Plant, etc.
  meta: { Descripcion: shortDescription, Precio: basePrice },
  links: { Storefront: location.origin },
});

      // 4) Ir a checkout (Storefront API)
      const variantId =
        selectedVariant?.id ||
        pots?.[selectedPotIndex]?.variants?.[0]?.id ||
        null;
      if (!variantId) throw new Error("variant-missing");

      const lines = [{ quantity, merchandiseId: toGid(variantId), attributes: attrs }];
      await cartCreateAndRedirect(lines);
    } catch (e) {
      alert(`No se pudo iniciar el checkout: ${e?.message || String(e)}`);
    }
  }

  return (
    <div className={styles?.container || ""} style={{ padding: 16, paddingBottom: 80 }}>
      <div className="row justify-content-center gx-5 gy-4">
        <div className="col-lg-5 col-md-8 col-12 text-center">
          <div className="btn-group mb-3" role="group" aria-label="Tamaño">
            {["Pequeño", "Mediano", "Grande"].map((s) => (
              <button key={s} className={`btn btn-sm ${activeSize === s ? "btn-dark" : "btn-outline-secondary"}`} onClick={() => setActiveSize(s)}>{s}</button>
            ))}
          </div>

          <div
            ref={sceneWrapRef}
            style={{ width: "100%", maxWidth: 520, aspectRatio: "500 / 650", background: "#f5f5f5", border: "3px dashed #6c757d", borderRadius: 20, position: "relative", overflow: "hidden" }}
            className="mx-auto mb-3"
          >
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
              <div style={{ display: "flex", transition: "transform .3s", transform: `translateX(-${selectedPotIndex * 100}%)` }}>
                {pots.map((p, idx) => {
                  const isSel = idx === selectedPotIndex;
                  const vImg = isSel ? (selectedVariant?.image || selectedVariant?.imageUrl) : null;
                  const img = vImg || p.image;
                  return (
                    <div key={p.id || idx} style={{ minWidth: "100%", display: "flex", justifyContent: "center", alignItems: "end", padding: 16 }}>
                      <img src={img} alt={p.title} style={{ maxWidth: "90%", maxHeight: 320, objectFit: "contain" }} />
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ position: "absolute", bottom: 260, left: 0, right: 0 }}>
              <div style={{ display: "flex", transition: "transform .3s", transform: `translateX(-${selectedPlantIndex * 100}%)` }}>
                {plants.map((p, idx) => (
                  <div key={p.id || idx} style={{ minWidth: "100%", display: "flex", justifyContent: "center", alignItems: "end", padding: 16 }}>
                    <img src={p.image} alt={p.title} style={{ maxWidth: "80%", maxHeight: 430, objectFit: "contain" }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-2">
            <button className="btn btn-outline-secondary btn-sm me-2" onClick={() => setSelectedPlantIndex((i) => (i > 0 ? i - 1 : Math.max(plants.length - 1, 0)))}>← Planta</button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedPlantIndex((i) => (i < plants.length - 1 ? i + 1 : 0))}>Planta →</button>
          </div>
          <div className="mb-3">
            <button className="btn btn-outline-secondary btn-sm me-2" onClick={() => setSelectedPotIndex((i) => (i > 0 ? i - 1 : Math.max(pots.length - 1, 0)))}>← Maceta</button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedPotIndex((i) => (i < pots.length - 1 ? i + 1 : 0))}>Maceta →</button>
          </div>

          <CustomizationOverlay mode="both" stageRef={stageRef} anchorRef={null} containerRef={sceneWrapRef} docked={false} />
        </div>

        <div className="col-lg-5 col-md-8 col-12 text-center">
          <div className="d-flex justify-content-center align-items-baseline gap-3 mb-4" style={{ marginTop: 20 }}>
            <span style={{ fontWeight: "bold", fontSize: "3rem" }}>{money(totalNow, "CLP")}</span>
          </div>

          {colorOptions.length > 0 && (
            <div className="mb-4">
              <h5>Color</h5>
              <div className="d-flex justify-content-center gap-3 flex-wrap">
                {colorOptions.map((c, i) => (
                  <div key={i} onClick={() => setSelectedColor(c)} title={c}
                    style={{ width: 36, height: 36, borderRadius: "50%", border: selectedColor===c ? "3px solid black":"1px solid #ccc", background: "#ddd", cursor: "pointer" }} />
                ))}
              </div>
            </div>
          )}

          <div className="d-flex flex-column align-items-center mb-5">
            <div className="input-group justify-content-center" style={{ maxWidth: 220 }}>
              <button className="btn btn-outline-secondary" onClick={() => setQuantity((p) => Math.max(1, p - 1))}>-</button>
              <input type="number" className="form-control text-center" min="1" value={quantity} onChange={(e)=> setQuantity(Math.max(1, Number(e.target.value)||1))} />
              <button className="btn btn-outline-secondary" onClick={() => setQuantity((p) => p + 1)}>+</button>
            </div>
            <button className="btn btn-dark px-4 py-2 mt-3" onClick={buyNow}>Comprar ahora</button>
          </div>
        </div>
      </div>
    </div>
  );
}
