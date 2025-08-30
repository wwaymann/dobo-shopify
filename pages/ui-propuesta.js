// pages/ui-propuesta.js
import { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

export default function UIPropuesta() {
  // ---------- Estado ----------
  const [size, setSize] = useState("12 cm");
  const [qty, setQty] = useState(1);
  const [color, setColor] = useState("gris");
  const [acc, setAcc] = useState({ kit: false, piedras: false });
  const price = 10000;
  const oldPrice = 13000;

  // ---------- Datos ----------
  const sizes = ["8 cm", "12 cm", "18 cm"];
  const colors = [
    { id: "gris", label: "Gris", var: "--brand-neutral-700" },
    { id: "blanco", label: "Blanco", var: "--brand-neutral-50" },
    { id: "amarillo", label: "Amarillo", var: "--brand-accent-500" },
  ];
  const accessories = [
    { id: "kit", name: "Kit mini herramientas" },
    { id: "piedras", name: "Piedras decorativas" },
  ];

  // ---------- Helpers ----------
  const toggleAcc = (id) => setAcc((p) => ({ ...p, [id]: !p[id] }));
  const dec = () => setQty((n) => Math.max(1, n - 1));
  const inc = () => setQty((n) => n + 1);

  return (
    <div className="container py-4">
      {/* ======= Paleta (CSS vars) ======= */}
      <style jsx global>{`
        :root {
          /* Propuesta de color DOBO */
          --brand-primary-600: #2e7d32;   /* verde hoja principal */
          --brand-primary-500: #43a047;
          --brand-primary-100: #e6f4ea;

          --brand-accent-600: #f9a825;    /* acento cálido */
          --brand-accent-500: #ffca28;
          --brand-accent-100: #fff7d6;

          --brand-neutral-900: #111827;   /* texto */
          --brand-neutral-700: #374151;   /* gris oscuro */
          --brand-neutral-400: #9ca3af;   /* bordes secundarios */
          --brand-neutral-200: #e5e7eb;   /* superficies suaves */
          --brand-neutral-100: #f3f4f6;
          --brand-neutral-50:  #ffffff;

          --surface: var(--brand-neutral-50);
          --panel:   var(--brand-neutral-100);
          --chip:    var(--brand-neutral-200);
          --dotted:  #c7cfd6;
          --success: #16a34a;
        }

        body {
          background: var(--surface);
          color: var(--brand-neutral-900);
        }

        /* Zona de edición */
        .edit-zone {
          background: linear-gradient(180deg, #fafafa 0%, #f5f7f9 100%);
          border: 2px dashed var(--dotted);
          border-radius: 18px;
          min-height: 620px;
        }

        /* Tarjetas panel derecha */
        .panel {
          background: var(--panel);
          border: 1px solid var(--brand-neutral-200);
          border-radius: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        }

        /* Chips */
        .chip {
          border: 1px solid var(--brand-neutral-200);
          background: var(--surface);
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 0.95rem;
          cursor: pointer;
          transition: transform .05s ease, background .2s;
        }
        .chip:hover { transform: translateY(-1px); }
        .chip.active {
          background: var(--brand-primary-100);
          border-color: var(--brand-primary-500);
          color: var(--brand-primary-600);
          font-weight: 600;
        }

        /* Swatches */
        .swatch {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid var(--brand-neutral-200);
          cursor: pointer;
          outline: 3px solid transparent;
          transition: outline-color .2s;
        }
        .swatch.active { outline-color: var(--brand-primary-500); }

        /* Botones acción */
        .btn-outline-primary-dobo {
          border-color: var(--brand-primary-600);
          color: var(--brand-primary-600);
          background: transparent;
        }
        .btn-outline-primary-dobo:hover {
          background: var(--brand-primary-100);
          color: var(--brand-primary-600);
        }
        .btn-primary-dobo {
          background: var(--brand-primary-600);
          border-color: var(--brand-primary-600);
        }
        .btn-primary-dobo:hover {
          background: var(--brand-primary-500);
          border-color: var(--brand-primary-500);
        }

        /* Accesorios */
        .acc-card {
          border: 1px solid var(--brand-neutral-200);
          border-radius: 12px;
          background: var(--surface);
          padding: 10px 12px;
          cursor: pointer;
          transition: box-shadow .15s, border-color .15s;
        }
        .acc-card.active {
          border-color: var(--brand-primary-500);
          box-shadow: 0 0 0 3px var(--brand-primary-100) inset;
        }

        /* Descripción */
        .section-title {
          font-weight: 700;
          font-size: 1.05rem;
        }
      `}</style>

      {/* ======= Layout ======= */}
      <div className="row g-4">
        {/* Izquierda: Zona editable */}
        <div className="col-lg-6">
          <div className="edit-zone d-flex align-items-center justify-content-center p-4 position-relative">
            {/* Imagen compositiva simulada */}
            <div className="w-100 text-center">
              <img
                src="https://images.unsplash.com/photo-1614594854930-b8d5b8fb50a2?q=80&w=800&auto=format&fit=crop"
                alt="Maceta + planta"
                className="img-fluid"
                style={{ maxHeight: 560, objectFit: "contain" }}
              />
            </div>

            {/* Botones diseño fijados abajo del marco */}
            <div className="position-absolute start-50 translate-middle-x" style={{ bottom: -24 }}>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-dark btn-sm">Seleccionar maceta</button>
                <button className="btn btn-dark btn-sm">Diseñar</button>
              </div>
            </div>
          </div>
        </div>

        {/* Derecha: Panel de compra */}
        <div className="col-lg-6">
          <div className="panel p-4">
            {/* Precio */}
            <div className="d-flex align-items-baseline gap-3 mb-2">
              <span className="text-decoration-line-through text-muted fs-6">
                ${oldPrice.toLocaleString("es-CL")}
              </span>
              <span className="fs-2 fw-bold">${price.toLocaleString("es-CL")}</span>
            </div>

            {/* Colores */}
            <div className="mb-3">
              <div className="mb-1 section-title">Color</div>
              <div className="d-flex align-items-center gap-3">
                {colors.map((c) => (
                  <div key={c.id} className="d-flex align-items-center gap-2">
                    <button
                      aria-label={c.label}
                      className={`swatch ${color === c.id ? "active" : ""}`}
                      style={{ background: `var(${c.var})` }}
                      onClick={() => setColor(c.id)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Tamaños */}
            <div className="mb-3">
              <div className="mb-1 section-title">Tamaño</div>
              <div className="d-flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button
                    key={s}
                    className={`chip ${size === s ? "active" : ""}`}
                    onClick={() => setSize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Accesorios multipick */}
            <div className="mb-3">
              <div className="mb-1 section-title">Accesorios</div>
              <div className="d-flex flex-wrap gap-2">
                {accessories.map((a) => (
                  <div
                    key={a.id}
                    className={`acc-card ${acc[a.id] ? "active" : ""}`}
                    onClick={() => toggleAcc(a.id)}
                    role="button"
                    aria-pressed={acc[a.id]}
                  >
                    <div className="form-check m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={acc[a.id]}
                        onChange={() => toggleAcc(a.id)}
                        id={`acc-${a.id}`}
                      />
                      <label className="form-check-label ms-2" htmlFor={`acc-${a.id}`}>
                        {a.name}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cantidad */}
            <div className="mb-4">
              <div className="mb-1 section-title">Cantidad</div>
              <div className="input-group" style={{ maxWidth: 180 }}>
                <button className="btn btn-outline-secondary" onClick={dec}>
                  −
                </button>
                <input
                  className="form-control text-center"
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                />
                <button className="btn btn-outline-secondary" onClick={inc}>
                  +
                </button>
              </div>
            </div>

            {/* CTA */}
            <div className="d-flex gap-2">
              <button className="btn btn-outline-primary-dobo w-50">Añadir al carro</button>
              <button className="btn btn-primary-dobo w-50">Comprar ahora</button>
            </div>
          </div>

          {/* Descripción resumida con "ver más" */}
          <Resumen />
        </div>
      </div>
    </div>
  );
}

function Resumen() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <div className="section-title mb-2">Descripción</div>
      <p className="m-0">
        El Ficus Lirata aporta un toque elegante y natural a interiores. La maceta de cemento
        ofrece durabilidad y un diseño minimalista. Ideal para realzar cualquier espacio.
      </p>
      {!open && (
        <button className="btn btn-link p-0 mt-1" onClick={() => setOpen(true)}>
          Ver más
        </button>
      )}
      {open && (
        <div className="mt-2">
          <ul className="mb-2">
            <li>Material maceta: mezcla cementicia sellada.</li>
            <li>Uso: interior o exterior protegido.</li>
            <li>Mantenimiento: limpiar con paño húmedo.</li>
          </ul>
          <button className="btn btn-link p-0" onClick={() => setOpen(false)}>
            Ver menos
          </button>
        </div>
      )}
    </div>
  );
}
