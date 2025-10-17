import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import styles from "../../styles/home.module.css";

import { cartCreateAndRedirect, toGid } from "../../lib/checkout";
import { getShopDomain } from "../../lib/shopDomain";

// === Cloudinary (subida unsigned) ===
const CLOUD_NAME   = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UNSIGNED_PRESET;

// Sube un dataURL o URL https a Cloudinary (unsigned)
async function uploadToCloudinary(dataUrl, filename = "layer.png") {
  try {
    if (!CLOUD_NAME || !CLOUD_PRESET || !dataUrl) return null;
    const form = new FormData();
    form.append("file", dataUrl);
    form.append("upload_preset", CLOUD_PRESET);
    form.append("public_id", `dobo/${Date.now()}-${filename}`);
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: form });
    const j = await r.json().catch(() => null);
    return j?.secure_url || null;
  } catch { return null; }
}

// Intenta exportar capas (imagen/texto) y preview desde tu diseñador y subirlas
async function exportImageTextLayers() {
  let imgData = null, txtData = null, prevData = null;

  try {
    // Opción 1: API del diseñador separando capas
    if (typeof window.exportOnly === "function") {
      try { imgData = await window.exportOnly(["image","imagen"]); } catch {}
      try { txtData = await window.exportOnly(["text","texto"]);   } catch {}
    }
    // Opción 2: devuelve todas las capas en PNG [{name,dataUrl}]
    if ((!imgData || !txtData) && typeof window.exportLayerAllPNG === "function") {
      try {
        const layers = await window.exportLayerAllPNG();
        const find = (names) => (layers || []).find(L => names.some(n => String(L?.name||"").toLowerCase().includes(n)));
        imgData = imgData || find(["image","imagen","plant","planta"])?.dataUrl || null;
        txtData = txtData || find(["text","texto"])?.dataUrl || null;
      } catch {}
    }
    // Preview general (si existe)
    if (typeof window.exportPreviewDataURL === "function") {
      try { prevData = await window.exportPreviewDataURL(); } catch {}
    }

    // Subir lo que haya
    const imageUrl   = imgData ? await uploadToCloudinary(imgData, "layer-image.png")  : null;
    const textUrl    = txtData ? await uploadToCloudinary(txtData, "layer-text.png")   : null;
    const previewUrl = prevData ? await uploadToCloudinary(prevData, "preview.png")    : (imageUrl || null);

    // Log de diagnóstico
    console.log("[DOBO] exportImageTextLayers", { CLOUD_NAME, CLOUD_PRESET, imageUrl, textUrl, previewUrl });

    return { imageUrl, textUrl, previewUrl };
  } catch {
    return { imageUrl: null, textUrl: null, previewUrl: null };
  }
}

// Sube un dataURL/blob a https (Cloudinary vía tu endpoint), o deja pasar si ya es https
async function ensureHttpsUrl(u) {
  try {
    const s = String(u || "");
    if (!s) return "";
    if (/^https:\/\//i.test(s)) return s;
    if (/^data:|^blob:/i.test(s)) {
      const r = await fetch("/api/upload-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: s }),
      });
      const j = await r.json().catch(() => null);
      return j?.ok && j?.url ? j.url : "";
    }
    return "";
  } catch {
    return "";
  }
}

function mergeAttrs(attrs = [], extras = []) {
  const map = new Map();
  for (const a of (attrs || [])) {
    const k = String(a?.key || "");
    if (k) map.set(k, String(a?.value ?? ""));
  }
  for (const e of (extras || [])) {
    if (!e) continue;
    const k = String(e.key || "");
    if (!k) continue;
    map.set(k, String(e.value ?? ""));
  }
  return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
}

// Captura de capas desde el DOM como última red de seguridad
function pickFromDom(stageRef, sceneWrapRef) {
  const root = stageRef?.current || sceneWrapRef?.current || document;
  const q = (sel) => { try { return root.querySelector(sel); } catch { return null; } };
  const toData = (c) => { try { return c?.toDataURL?.("image/png", 0.92) || ""; } catch { return ""; } };
  const fromImg = (img) => { try { return img?.src || ""; } catch { return ""; } };
  const svgUrl = (el) => {
    try {
      const svg = el?.outerHTML || "";
      if (!svg) return "";
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      return URL.createObjectURL(blob); // luego se sube a https
    } catch { return ""; }
  };

  // Preview
  let preview = "";
  const cPrev = q("canvas[data-preview='true'], canvas#dobo-preview, canvas");
  const iPrev = q("img[data-preview='true'], img#dobo-preview");
  if (cPrev) preview = toData(cPrev);
  else if (iPrev) preview = fromImg(iPrev);

  // Capa imagen
  let layerImage = "";
  const cImg = q("canvas[data-layer='image'], canvas#dobo-layer-image");
  const iImg = q("img[data-layer='image'], img#dobo-layer-image, img[data-layer='base']");
  if (cImg) layerImage = toData(cImg);
  else if (iImg) layerImage = fromImg(iImg);

  // Capa texto (SVG preferido)
  let layerText = "";
  const svgTxt = q("svg[data-layer='text'], svg#dobo-layer-text");
  const htmlTxt = q("[data-layer='text'], #dobo-layer-text");
  if (svgTxt) layerText = svgUrl(svgTxt);
  // (Si tu texto no es SVG, puedes rasterizar htmlTxt con html2canvas si lo tienes cargado.)

  return { preview, layerImage, layerText };
}
// Normaliza attrs a pares {key,value} string
function normAttrs(arr = []) {
  return (Array.isArray(arr) ? arr : [])
    .map(a => ({ key: String(a?.key || ''), value: String(a?.value ?? '') }))
    .filter(a => a.key);
}

// Subconjunto “delgado” para email (no metas objetos gigantes)
function pickAttrsForEmail(attrs = []) {
  const keep = new Set(['designid','_designid']);
  return normAttrs(attrs).filter(a => {
    const k = a.key.toLowerCase();
    return k.startsWith('layer:') ||
           k.includes('designpreview') ||
           keep.has(k);
  });
}

// Intenta completar Layer:* desde varias fuentes
function withLayerFallbacks(attrs = []) {
  const out = [...normAttrs(attrs)];
  const has = (name) => out.some(a => a.key.toLowerCase() === name.toLowerCase());

  // Si tu helper ya puso Layer:Image/Layer:Text, los respetamos.
  // Si no, probamos variables globales que puedas setear desde tu overlay:
  const LAYER_IMAGE = window?.DOBO_LAYER_IMAGE || '';
  const LAYER_TEXT  = window?.DOBO_LAYER_TEXT  || '';

  if (!has('Layer:Image') && LAYER_IMAGE) out.push({ key: 'Layer:Image', value: LAYER_IMAGE });
  if (!has('Layer:Text')  && LAYER_TEXT)  out.push({ key: 'Layer:Text',  value: LAYER_TEXT  });

  return out;
}

function sendEmailNow(payload) {
  try {
    const url = new URL("/api/send-design-email", location.origin).toString();
    const json = JSON.stringify(payload);
    if (navigator.sendBeacon && json.length < 64000) {
      const blob = new Blob([json], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: json })
      .then(r => r.json())
      .then(r => { if (!r?.ok) console.warn("email api not ok:", r); })
      .catch(err => console.warn("email api error:", err));
  } catch (e) {
    console.warn("sendEmailNow failed", e);
  }
}

// --- Helpers de email (cliente) ---
// Reduce attrs a lo esencial para que sendBeacon no explote por tamaño
function shrinkAttrsForEmail(attrs = []) {
  const keep = new Set([
    "_designid", "designid",
    "_designpreview", "designpreview",
  ]);
  const out = [];
  for (const a of attrs) {
    const k = String(a?.key || "");
    const v = String(a?.value ?? "");
    const lk = k.toLowerCase();
    if (keep.has(lk) || lk.startsWith("layer:") || lk.startsWith("capa:")) {
      // URLs de capas/preview son válidas
      out.push({ key: k, value: v });
    }
  }
  // evita payloads ridículos
  return out.slice(0, 50);
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

// ---------------- Comprar ahora (reemplaza tu buyNow por éste) ----------------
// ---------------- Comprar ahora (versión final) ----------------
async function buyNow() {
  try {
    // 1) Atributos (tu helper si existe)
    let attrs = [];
    if (typeof window.buildAndSaveDesignForCartCheckout === "function") {
      const r = await window.buildAndSaveDesignForCartCheckout();
      attrs = Array.isArray(r?.attributes) ? r.attributes : [];
    } else if (typeof window.prepareDesignAttributes === "function") {
      attrs = await window.prepareDesignAttributes();
    } else {
      attrs = await minimalDesignAttributes();
    }

    // 1.1) Completar con Layer:* si aún no están (desde globals u otras fuentes)
    attrs = withLayerFallbacks(attrs);

    // 2) Precio + descripción corta
    const potPrice = selectedVariant?.price ? num(selectedVariant.price) : 0;
    const plantPrice = num(plants?.[selectedPlantIndex]?.minPrice);
    const basePrice = Math.max(0, Number(((potPrice + plantPrice) * quantity).toFixed(2)));
    const shortDescription = (
      `DOBO ${plants?.[selectedPlantIndex]?.title ?? ""} + ` +
      `${pots?.[selectedPotIndex]?.title ?? ""} · ` +
      `${activeSize ?? ""} · ${selectedColor ?? ""}`
    ).replace(/\s+/g, " ").trim();

    // 3) Disparar email (no bloqueante) con attrs delgadas (incluye layer:* y preview)
    const thinAttrs = pickAttrsForEmail(attrs);
    sendEmailNow({
      attachPreviews: true,
      attrs: thinAttrs,
      meta:  { Descripcion: shortDescription, Precio: basePrice },
      links: { Storefront: location.origin }
    });

    // 4) Crear producto DOBO (pasando también attrs al server para que él dispare otro email)
    const resp = await fetch("/api/design-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `DOBO ${plants?.[selectedPlantIndex]?.title ?? ""} + ${pots?.[selectedPotIndex]?.title ?? ""}`.trim(),
        previewUrl:
          thinAttrs.find(a => a.key.toLowerCase().includes('designpreview'))?.value || "",
        price: basePrice,
        color: selectedColor || "Único",
        size:  activeSize     || "Único",
        designId:
          thinAttrs.find(a => a.key.toLowerCase() === 'designid' || a.key.toLowerCase() === '_designid')?.value
          || `dobo-${Date.now()}`,
        plantTitle: plants?.[selectedPlantIndex]?.title || "Planta",
        potTitle:   pots?.[selectedPotIndex]?.title    || "Maceta",
        shortDescription,
        publishOnline: true,
        // 🔴 AQUÍ viajan las capas al servidor:
        attrs: thinAttrs,
      }),
    });

    const dp = await resp.json().catch(() => null);
    if (!resp.ok || !dp?.ok || !dp?.variantId) {
      console.warn("design-product falló; usaré la variante actual", dp);
    }

    // 5) Checkout (usa DOBO si lo creó, si no la variante actual)
    const variantId =
      dp?.variantId ||
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
