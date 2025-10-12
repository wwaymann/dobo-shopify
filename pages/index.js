// pages/index.js — DOBO (reemplazo completo y estable)
// Next.js 15.x | Evita errores #418/#423 (hidratación) y TDZ ("Cannot access 'S' before initialization")
// Estrategia:
//  - Sin returns tempranos por SSR/hidratación: TODOS los hooks se ejecutan siempre.
//  - Nada de lecturas de window/DOM en render (solo en useEffect/handlers).
//  - designStore se importa DINÁMICAMENTE on-demand (evita ciclos/TDZ).
//  - CustomizationOverlay client-only (ssr:false).
//  - Carrusel 1 ítem centrado; teclado/drag/rueda/touch.
//  - Controles bajo el carrusel; layout 2 col en desktop, 1 en móvil.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";

// ⚠️ No importes "bootstrap/dist/css/bootstrap.min.css" aquí.
// Para evitar conflictos de hidratación, cargamos Bootstrap por CDN en <Head>.

// Carga client-only del editor para evitar SSR y ciclos
const CustomizationOverlay = dynamic(
  () => import("../components/CustomizationOverlay"),
  { ssr: false }
);

// ========================= Utils =========================
function clsx(...xs) {
  return xs.filter(Boolean).join(" ");
}
function debounce(fn, ms = 120) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

function GlobalCSS() {
  return (
    <style>{`
      html, body, #__next { height: 100%; margin: 0; padding: 0; }
      * { box-sizing: border-box; }
      img { max-width: 100%; height: auto; display: block; }
      .dobo-no-select { user-select: none; -webkit-user-select: none; }
      .dobo-scroll-x { scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
      .dobo-snap-center { scroll-snap-align: center; }
      .dobo-card { border-radius: 12px; }
      .dobo-soft { background: #fff; border: 1px solid #e9ecef; }
      .dobo-shadow { box-shadow: 0 2px 10px rgba(0,0,0,0.06); }
      .dobo-sticky-bottom { position: sticky; bottom: 0; background: #fff; z-index: 5; }
    `}</style>
  );
}

/* ======================= Carrusel (1 ítem centrado) ======================= */
function PotCard({ product, isActive }) {
  const img =
    product?.images?.[0]?.src ||
    product?.image?.src ||
    product?.featuredImage?.url ||
    "";
  const title = product?.title || product?.name || "Producto";
  return (
    <div
      className={clsx(
        "d-flex justify-content-center align-items-center dobo-snap-center dobo-no-select",
        "w-100"
      )}
      style={{
        height: 360,
        cursor: "grab",
        transition: "transform 260ms ease",
        transform: isActive ? "scale(1.0)" : "scale(0.94)",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 440 }}>
        {img ? (
          <img
            src={img}
            alt={title}
            style={{ maxWidth: "100%", maxHeight: 320, objectFit: "contain" }}
            draggable={false}
          />
        ) : (
          <div className="bg-light border" style={{ width: 320, height: 320 }} />
        )}
        <div className="mt-2 text-muted" style={{ fontSize: 14 }}>
          {title}
        </div>
      </div>
    </div>
  );
}

function CenterCarousel({ items, activeIndex, onIndexChange }) {
  const scrollerRef = useRef(null);
  const stateRef = useRef({
    dragging: false,
    startX: 0,
    startLeft: 0,
    pointerId: null,
  });

  const scrollToIndex = useCallback((idx) => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    el.scrollTo({ left: Math.max(0, idx * w), behavior: "smooth" });
  }, []);

  // Teclado
  useEffect(() => {
    const onKey = (e) => {
      if (!scrollerRef.current) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onIndexChange(Math.min(items.length - 1, activeIndex + 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onIndexChange(Math.max(0, activeIndex - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, items.length, onIndexChange]);

  // Rueda (vertical → horizontal)
  useEffect(() => {
    const el = scrollerRef.current; if (!el) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Drag/touch con detección de soporte
  useEffect(() => {
    const el = scrollerRef.current; if (!el) return;

    const onPointerDown = (e) => {
      const x = e.clientX ?? (e.touches?.[0]?.clientX ?? 0);
      stateRef.current = {
        dragging: true,
        startX: x,
        startLeft: el.scrollLeft,
        pointerId: e.pointerId ?? null
      };
      el.style.scrollSnapType = "none";
      if (e.pointerId != null && el.setPointerCapture) {
        try { el.setPointerCapture(e.pointerId); } catch {}
      }
    };
    const onPointerMove = (e) => {
      const st = stateRef.current; if (!st.dragging) return;
      const x = e.clientX ?? (e.touches?.[0]?.clientX ?? 0);
      const dx = st.startX - x;
      el.scrollLeft = st.startLeft + dx;
    };
    const finish = () => {
      const st = stateRef.current;
      const wasDragging = st.dragging;
      stateRef.current.dragging = false;
      el.style.scrollSnapType = "x mandatory";
      if (st.pointerId != null && el.releasePointerCapture) {
        try { el.releasePointerCapture(st.pointerId); } catch {}
      }
      if (!wasDragging) return;
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      scrollToIndex(idx);
      onIndexChange(idx);
    };

    const supportPointer = typeof window !== "undefined" && "PointerEvent" in window;

    if (supportPointer) {
      el.addEventListener("pointerdown", onPointerDown);
      el.addEventListener("pointermove", onPointerMove);
      el.addEventListener("pointerup", finish);
      el.addEventListener("pointercancel", finish);
    } else {
      // Fallback touch + mouse
      el.addEventListener("touchstart", onPointerDown, { passive: true });
      el.addEventListener("touchmove", (ev) => { ev.preventDefault(); onPointerMove(ev); }, { passive: false });
      el.addEventListener("touchend", finish);
      el.addEventListener("mousedown", onPointerDown);
      el.addEventListener("mousemove", onPointerMove);
      el.addEventListener("mouseup", finish);
      el.addEventListener("mouseleave", finish);
    }

    return () => {
      if (supportPointer) {
        el.removeEventListener("pointerdown", onPointerDown);
        el.removeEventListener("pointermove", onPointerMove);
        el.removeEventListener("pointerup", finish);
        el.removeEventListener("pointercancel", finish);
      } else {
        el.removeEventListener("touchstart", onPointerDown);
        el.removeEventListener("touchmove", onPointerMove);
        el.removeEventListener("touchend", finish);
        el.removeEventListener("mousedown", onPointerDown);
        el.removeEventListener("mousemove", onPointerMove);
        el.removeEventListener("mouseup", finish);
        el.removeEventListener("mouseleave", finish);
      }
    };
  }, [onIndexChange, scrollToIndex]);

  // Mantener centrado cuando cambia activeIndex
  useEffect(() => { scrollToIndex(activeIndex); }, [activeIndex, scrollToIndex]);

  // Sincronizar índice cuando el usuario hace scroll manual
  useEffect(() => {
    const el = scrollerRef.current; if (!el) return;
    const onScroll = debounce(() => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      if (idx !== activeIndex) onIndexChange(idx);
    }, 120);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [activeIndex, onIndexChange]);

  return (
    <div
      ref={scrollerRef}
      className="w-100 dobo-scroll-x"
      style={{ overflowX: "auto", overflowY: "hidden", display: "grid", gridAutoFlow: "column", gridAutoColumns: "100%" }}
    >
      {items.map((p, i) => <PotCard key={p?.id || i} product={p} isActive={i === activeIndex} />)}
    </div>
  );
}

/* ======================= Selectores & Menú ======================= */
function VariantSelector({ product, value, onChange }) {
  const variants = product?.variants || []; if (!variants.length) return null;
  return (
    <div className="mb-3">
      <div className="text-muted" style={{ fontSize: 14 }}>Variantes</div>
      <div className="d-flex flex-wrap gap-2 mt-1">
        {variants.map((v) => (
          <button
            key={v?.id || v?.title}
            type="button"
            onClick={() => onChange(v)}
            className={clsx("btn btn-sm", value?.id === v?.id ? "btn-primary" : "btn-outline-secondary")}
          >
            {v?.title || "Variante"}
          </button>
        ))}
      </div>
    </div>
  );
}

function AccessorySelector({ items = [], selectedIds = [], onToggle }) {
  if (!items.length) return null;
  return (
    <div className="mb-3">
      <div className="text-muted" style={{ fontSize: 14 }}>Accesorios</div>
      <div className="d-flex flex-wrap gap-2 mt-1">
        {items.map((a) => {
          const on = selectedIds.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onToggle(a)}
              className={clsx("btn btn-sm", on ? "btn-success" : "btn-outline-secondary")}
              title={a.title}
            >
              {a.title} {a.price ? `(+${Number(a.price).toLocaleString("es-CL")})` : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BottomMenu({ canPrev, canNext, onPrev, onNext, index, total, onExportAll, onExportText, onExportImage }) {
  return (
    <div className="dobo-sticky-bottom pt-2">
      <div className="d-flex justify-content-between align-items-center">
        <div className="btn-group" role="group">
          <button type="button" className="btn btn-outline-secondary" onClick={onPrev} disabled={!canPrev}>← Anterior</button>
          <button type="button" className="btn btn-outline-secondary" onClick={onNext} disabled={!canNext}>Siguiente →</button>
        </div>
        <div style={{ fontSize: 13 }}>{total > 0 ? (<span>{index + 1} / {total}</span>) : null}</div>
      </div>
      <div className="d-flex flex-wrap gap-2 mt-2">
        <button className="btn btn-outline-secondary" onClick={onExportAll}>Exportar PNG (todo)</button>
        <button className="btn btn-outline-secondary" onClick={onExportText}>Solo texto</button>
        <button className="btn btn-outline-secondary" onClick={onExportImage}>Solo imagen</button>
      </div>
    </div>
  );
}

/* ============== Carga dinámica de designStore (anti-TDZ/ciclos) ============== */
async function getDesignExports() {
  const mod = await import("../lib/designStore");
  return {
    exportLayerAllPNG: mod.exportLayerAllPNG,
    exportOnly: mod.exportOnly,
    exportPreviewDataURL: mod.exportPreviewDataURL,
    dataURLtoBase64Attachment: mod.dataURLtoBase64Attachment,
    loadLocalDesign: mod.loadLocalDesign,
  };
}

/* ============================= Página principal ============================= */
export default function Home() {
  const hydrated = useHydrated();

  // Estado base
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [plants, setPlants] = useState([]);

  // Selecciones
  const [activeIndex, setActiveIndex] = useState(0);
  const activeProduct = products[activeIndex] || null;
  const [variant, setVariant] = useState(null);
  const [accessories, setAccessories] = useState([]);
  const [selectedAccessoryIds, setSelectedAccessoryIds] = useState([]);

  // Editor
  const [showCustomizer, setShowCustomizer] = useState(false);

  // Data fetch (cliente)
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const rp = await fetch("/api/products");
        const jp = await rp.json().catch(() => ({}));
        const list = jp?.products || jp?.data || jp || [];

        let lp = [];
        try {
          const r2 = await fetch("/api/plants");
          const j2 = await r2.json().catch(() => ({}));
          lp = j2?.plants || j2?.data || [];
        } catch {}

        // TODO: si tienes /api/accessories, cárgalos aquí.
        const acc = [];

        if (!cancel) {
          setProducts(Array.isArray(list) ? list : []);
          setPlants(Array.isArray(lp) ? lp : []);
          setAccessories(acc);
          setVariant((Array.isArray(list) && list[0]?.variants?.[0]) || null);
        }
      } catch (e) {
        if (!cancel) setError(e?.message || "Error cargando datos");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  // Precio
  const basePrice = useMemo(() => {
    const p = activeProduct;
    const byVariant = variant?.price
      || p?.variants?.[0]?.price
      || p?.price
      || p?.priceRange?.minVariantPrice?.amount;
    const num = Number(byVariant ?? 0);
    return Number.isFinite(num) ? num : 0;
  }, [activeProduct, variant]);

  const accessoriesTotal = useMemo(() => selectedAccessoryIds.reduce((acc, id) => {
    const item = accessories.find((a) => a.id === id);
    const price = Number(item?.price ?? 0);
    return acc + (Number.isFinite(price) ? price : 0);
  }, 0), [selectedAccessoryIds, accessories]);

  const totalPrice = basePrice + accessoriesTotal;

  // Acciones
  const toggleAccessory = (accItem) =>
    setSelectedAccessoryIds((prev) =>
      prev.includes(accItem.id) ? prev.filter((x) => x !== accItem.id) : [...prev, accItem.id]
    );

  const goPrev = () => setActiveIndex((i) => Math.max(0, i - 1));
  const goNext = () => setActiveIndex((i) => Math.min(products.length - 1, i + 1));

  const handleAddToCart = async () => {
    try {
      alert("Añadido (demo) — conecta /api/cart o checkout");
    } catch (e) {
      console.error(e);
      alert("Error al añadir al carrito");
    }
  };

  // Exports
  const handleExportAll = async () => {
    const { exportLayerAllPNG } = await getDesignExports();
    const dataURL = await exportLayerAllPNG(3);
    if (!dataURL) return alert("No se pudo exportar PNG");
    const a = document.createElement("a"); a.href = dataURL; a.download = "dobo-disenho.png"; a.click();
  };
  const handleExportText = async () => {
    const { exportOnly } = await getDesignExports();
    const dataURL = await exportOnly("text", 3);
    if (!dataURL) return alert("No se pudo exportar la capa de texto");
    const a = document.createElement("a"); a.href = dataURL; a.download = "dobo-texto.png"; a.click();
  };
  const handleExportImage = async () => {
    const { exportOnly } = await getDesignExports();
    const dataURL = await exportOnly("image", 3);
    if (!dataURL) return alert("No se pudo exportar la capa de imagen");
    const a = document.createElement("a"); a.href = dataURL; a.download = "dobo-imagen.png"; a.click();
  };

  /* ============================= Render ============================= */
  return (
    <>
      <Head>
        <title>DOBO · Personaliza tu maceta</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Bootstrap por CDN para evitar import global en la página */}
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
          rel="stylesheet"
          crossOrigin="anonymous"
        />
      </Head>
      <GlobalCSS />

      {!hydrated ? (
        <div style={{ minHeight: "100vh" }} />
      ) : (
        <div className="container-fluid py-3">
          <div className="row g-3">
            {/* IZQUIERDA: Carrusel + menú inferior */}
            <div className="col-12 col-md-7">
              <div className="position-relative dobo-card dobo-soft dobo-shadow p-2">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <strong>Selecciona tu maceta</strong>
                    {activeProduct?.title ? (<span className="ms-2 text-muted">· {activeProduct.title}</span>) : null}
                  </div>
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    {loading ? "Cargando…" : error ? "Error" : `${products.length} opciones`}
                  </div>
                </div>

                {products.length === 0 ? (
                  <div className="bg-light border d-flex align-items-center justify-content-center" style={{ height: 360 }}>
                    {loading ? "Cargando productos…" : error ? "No se pudieron cargar productos" : "Sin productos"}
                  </div>
                ) : (
                  <CenterCarousel
                    items={products}
                    activeIndex={activeIndex}
                    onIndexChange={(i) => {
                      setActiveIndex(i);
                      setVariant(products[i]?.variants?.[0] || null);
                    }}
                  />
                )}

                <BottomMenu
                  canPrev={activeIndex > 0}
                  canNext={activeIndex < products.length - 1}
                  onPrev={goPrev}
                  onNext={goNext}
                  index={activeIndex}
                  total={products.length}
                  onExportAll={handleExportAll}
                  onExportText={handleExportText}
                  onExportImage={handleExportImage}
                />
              </div>

              <div className="mt-3 d-flex gap-2">
                <button className="btn btn-outline-primary" onClick={() => setShowCustomizer((v) => !v)}>
                  {showCustomizer ? "Ocultar editor" : "Mostrar editor"}
                </button>
              </div>

              {showCustomizer ? (
                <div className="mt-3 dobo-card dobo-soft dobo-shadow p-2">
                  <CustomizationOverlay />
                </div>
              ) : null}
            </div>

            {/* DERECHA: Resumen y acciones */}
            <div className="col-12 col-md-5">
              <div className="dobo-card dobo-soft dobo-shadow p-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <strong>Resumen</strong>
                  <span className="badge text-bg-light">DOBO</span>
                </div>

                <div className="mb-2">
                  <div className="text-muted" style={{ fontSize: 14 }}>Producto seleccionado</div>
                  <div style={{ fontWeight: 500 }}>{activeProduct?.title || "—"}</div>
                </div>

                <VariantSelector product={activeProduct} value={variant} onChange={setVariant} />
                <AccessorySelector items={accessories} selectedIds={selectedAccessoryIds} onToggle={toggleAccessory} />

                <div className="mb-3">
                  <div className="text-muted" style={{ fontSize: 14 }}>Precio</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>
                    {totalPrice > 0 ? `$${totalPrice.toLocaleString("es-CL")}` : "—"}
                  </div>
                  {accessoriesTotal > 0 ? (
                    <div className="text-muted" style={{ fontSize: 13 }}>
                      Incluye accesorios: ${accessoriesTotal.toLocaleString("es-CL")}
                    </div>
                  ) : null}
                </div>

                <div className="d-grid gap-2 mb-2">
                  <button className="btn btn-primary" onClick={handleAddToCart} disabled={!activeProduct}>
                    Añadir al carrito
                  </button>
                </div>

                <div className="small text-muted">
                  • Controles bajo el carrusel. • 1 ítem visible y centrado. • Teclado, drag y rueda.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
