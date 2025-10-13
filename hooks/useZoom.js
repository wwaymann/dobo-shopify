"use client";
import { useEffect } from "react";
export default function useZoom(containerRef, stageRef, { min=0.5, max=2.5, step=0.08 } = {}) {
  useEffect(() => {
    const container = containerRef?.current, stage = stageRef?.current;
    if (!container || !stage) return;
    let zoom = Number(getComputedStyle(stage).getPropertyValue("--zoom") || "0.75") || 0.75;
    stage.style.setProperty("--zoom", String(zoom));
    let target = zoom, raf = 0;
    const clamp = (v) => Math.min(max, Math.max(min, v));
    const schedule = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; stage.style.setProperty("--zoom", String(target)); container.style.setProperty("--zoom", String(target)); }); };
    const onWheel = (e) => { if (!stage.contains(e.target)) return; e.preventDefault(); const dir = e.deltaY > 0 ? -1 : 1; zoom = clamp(zoom + dir * step); target = zoom; schedule(); };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => { container.removeEventListener("wheel", onWheel); if (raf) cancelAnimationFrame(raf); };
  }, [containerRef, stageRef, min, max, step]);
}
