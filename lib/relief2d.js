function shadeImageSDF(baseCtx, maskCtx, {
  bevelPx = 16,
  strength = 1.3,
  light = [-0.9, -0.55, 0.35],
  ao = 0.18,
  cylK = 0.38,
  cylCX = 0.50
} = {}) {
  const w = baseCtx.canvas.width, h = baseCtx.canvas.height;

  // --- 1) máscara suavizada y SDF interior ---
  const blur = Math.max(1, Math.floor(w / 400));
  const tC = makeCanvas(w, h), tX = tC.getContext('2d', { willReadFrequently: true });
  tX.filter = `blur(${blur}px)`; tX.drawImage(maskCtx.canvas, 0, 0);
  const { arr: gray } = getGrayWithAlpha(tX.getImageData(0, 0, w, h));
  const sdf = signedDistanceInside(gray, w, h);

  // perfil de bisel redondo
  const R = Math.max(1, bevelPx);
  const H = new Float32Array(w * h);
  for (let i = 0; i < H.length; i++) {
    const q = Math.max(0, Math.min(1, (R - sdf[i]) / R));
    H[i] = Math.pow(q, 0.6);
  }

  // --- 2) normales (bisel + curvatura cilíndrica) ---
  const nx = new Float32Array(w * h), ny = new Float32Array(w * h), nz = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      let X = -(H[i + 1] - H[i - 1]) * 0.5 * strength;
      let Y = -(H[i + w] - H[i - w]) * 0.5 * strength;
      let Z = 1.0;

      // cilindro
      const u = Math.max(-1, Math.min(1, ((x - Math.floor(w * cylCX)) / w) / cylK));
      const cX = -u, cY = 0.0, cZ = Math.sqrt(Math.max(0, 1 - cX * cX));
      const m = Math.pow(gray[i], 0.7);
      X = (1 - m) * cX + m * X; Y = (1 - m) * cY + m * Y; Z = (1 - m) * cZ + m * Z;

      const L = Math.hypot(X, Y, Z) || 1; nx[i] = X / L; ny[i] = Y / L; nz[i] = Z / L;
    }
  }

  // --- 3) iluminación difusa + especular, SOLO dentro de la máscara ---
  const Llen = Math.hypot(light[0], light[1], light[2]) || 1;
  const Lx = light[0] / Llen, Ly = light[1] / Llen, Lz = light[2] / Llen;
  let Hx = Lx, Hy = Ly, Hz = Lz + 1; { const s = Math.hypot(Hx, Hy, Hz) || 1; Hx /= s; Hy /= s; Hz /= s; }
  const baseline = Lz;

  const base = baseCtx.getImageData(0, 0, w, h), out = baseCtx.createImageData(w, h);
  const bd = base.data, od = out.data;

  // magnitud de borde para concentrar brillo
  const edge = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = Math.abs(H[i + 1] - H[i - 1]);
      const gy = Math.abs(H[i + w] - H[i - w]);
      edge[i] = Math.min(1, (gx + gy) * 8.0);
    }
  }

  for (let y = 0, p = 0; y < h; y++) {
    for (let x = 0; x < w; x++, p++) {
      const r = bd[p * 4], g = bd[p * 4 + 1], b = bd[p * 4 + 2];
      const m = gray[p];
      if (m <= 0.001) { od[p * 4] = r; od[p * 4 + 1] = g; od[p * 4 + 2] = b; od[p * 4 + 3] = 255; continue; }

      const d = nx[p] * Lx + ny[p] * Ly + nz[p] * Lz;
      const delta = d - baseline;
      const kd = 1.28;
      let fr = r * (1 + kd * delta);
      let fg = g * (1 + kd * delta);
      let fb = b * (1 + kd * delta);

      const spec = Math.max(nx[p] * Hx + ny[p] * Hy + nz[p] * Hz, 0);
      const crest = Math.pow(spec, 52) * 255 * Math.min(1, edge[p] * 1.2);
      fr = Math.min(255, fr + crest);
      fg = Math.min(255, fg + crest);
      fb = Math.min(255, fb + crest);

      const aoDark = 1 - ao * m;
      od[p * 4] = Math.max(0, Math.min(255, fr * aoDark));
      od[p * 4 + 1] = Math.max(0, Math.min(255, fg * aoDark));
      od[p * 4 + 2] = Math.max(0, Math.min(255, fb * aoDark));
      od[p * 4 + 3] = 255;
    }
  }
  baseCtx.putImageData(out, 0, 0);

  // --- 4) highlight/sombra de borde DESPLAZADOS, PERO ENMASCARADOS ---
  const depth = Math.max(8, Math.floor(w / 160));
  const blurB = Math.max(1, Math.floor(w / 400));

  // máscaras de borde: outer = dilate(mask) - mask
  const mm = makeCanvas(w, h), mx = mm.getContext('2d'); mx.putImageData(tX.getImageData(0, 0, w, h), 0, 0);
  const dil = makeCanvas(w, h), dx = dil.getContext('2d');
  dx.filter = `blur(${1}px)`; dx.drawImage(mm, 0, 0);

  const edgeOuter = makeCanvas(w, h), ex = edgeOuter.getContext('2d');
  ex.globalCompositeOperation = 'source-over';
  ex.drawImage(dx.canvas, 0, 0);
  ex.globalCompositeOperation = 'destination-out';
  ex.drawImage(mm, 0, 0); // queda solo el borde externo
  ex.globalCompositeOperation = 'source-over';
  ex.filter = `blur(${blurB}px)`;

  // highlight
  const hi = makeCanvas(w, h), hix = hi.getContext('2d');
  hix.clearRect(0, 0, w, h);
  hix.drawImage(edgeOuter, 0, 0);
  hix.globalCompositeOperation = 'source-in';
  hix.fillStyle = 'rgba(255,255,255,0.35)';
  hix.fillRect(0, 0, w, h);

  // shadow
  const sh = makeCanvas(w, h), shx = sh.getContext('2d');
  shx.clearRect(0, 0, w, h);
  shx.drawImage(edgeOuter, 0, 0);
  shx.globalCompositeOperation = 'source-in';
  shx.fillStyle = 'rgba(0,0,0,0.45)';
  shx.fillRect(0, 0, w, h);

  // aplicar con offsets, sin afectar fuera del borde
  baseCtx.drawImage(hi, -depth, -depth);
  baseCtx.drawImage(sh,  depth,  depth);
}
