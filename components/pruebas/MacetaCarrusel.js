import { useEffect, useState } from "react";

export function useMacetaCurvas(imagen, CANVAS_SIZE = 500) {
  const SAMPLE_COLUMNS = 40;
  const [shape, setShape] = useState(null);

  useEffect(() => {
    const img = new Image();
    img.src = imagen;
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const off = document.createElement("canvas");
      off.width = CANVAS_SIZE;
      off.height = CANVAS_SIZE;
      const ctx = off.getContext("2d");

      const maxW = CANVAS_SIZE * 0.75;
      const w = maxW;
      const h = (img.height / img.width) * w;
      const x = (CANVAS_SIZE - w) / 2;
      const y = (CANVAS_SIZE - h) / 2;

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(img, x, y, w, h);

      const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      const data = imageData.data;

      const topPoints = [];
      const bottomPoints = [];

      const xStart = Math.round(CANVAS_SIZE * 0.15);
      const xEnd = Math.round(CANVAS_SIZE * 0.85);

      for (let i = 0; i <= SAMPLE_COLUMNS; i++) {
        const colX = Math.round(
          xStart + ((xEnd - xStart) * i) / SAMPLE_COLUMNS
        );

        let topY = null;
        let bottomY = null;

        // borde superior
        for (let yy = 0; yy < CANVAS_SIZE; yy++) {
          if (data[(yy * CANVAS_SIZE + colX) * 4 + 3] > 10) {
            topY = yy;
            break;
          }
        }

        // borde inferior
        for (let yy = CANVAS_SIZE - 1; yy >= 0; yy--) {
          if (data[(yy * CANVAS_SIZE + colX) * 4 + 3] > 10) {
            bottomY = yy;
            break;
          }
        }

        if (topY != null && bottomY != null) {
          topPoints.push({ x: colX, y: topY });
          bottomPoints.push({ x: colX, y: bottomY });
        }
      }

      const avgTop =
        topPoints.reduce((s, p) => s + p.y, 0) / topPoints.length;
      const avgBottom =
        bottomPoints.reduce((s, p) => s + p.y, 0) / bottomPoints.length;

      const yMinText = avgTop + 5;
      const yMaxText = avgBottom - 5;

      setShape({
        topPoints,
        bottomPoints,
        imageRect: { x, y, w, h },
        yMinText,
        yMaxText,
      });
    };
  }, [imagen]);

  return shape;
}
