"use client";
import React, { useEffect, useState } from "react";

export default function CustomizationOverlay(props) {
  const [Impl, setImpl] = useState(null);

  useEffect(() => {
    let mounted = true;
    import("./CustomizationOverlay.impl")
      .then((m) => { if (mounted) setImpl(() => m?.default || m); })
      .catch((err) => { console.error("[CustomizationOverlay] load error:", err); setImpl(() => () => null); });
    return () => { mounted = false; };
  }, []);

  if (!Impl) {
    return (
      <div style={{ marginTop: 12 }}>
        <div className="d-inline-flex align-items-center gap-2 px-3 py-2 border rounded-3">
          <div className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
          <span style={{ fontSize: 12, color: "#6c757d" }}>Cargando editor…</span>
        </div>
      </div>
    );
  }
  return <Impl {...props} />;
}
