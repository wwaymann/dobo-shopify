'use client';

// Relieve 2D con SDF (sin Three.js)

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
    if (typeof img.decode === 'function') {
      img.decode().then(() => resolve(img)).catch(() => {});
    }
  });
}

function getGrayWithAlpha(imgData) {
  const { data, width: w, height: h } = imgData;
  const out = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    out[p] = (lum / 255) * (a / 255);
  }
  return { arr: out, width: w, height: h };
}

// --- EDT 1D ---
function edt1d(f, n) {
  const v = new Int16Array(n);
  const z = new Float32Array(n + 1);
  const d = new Float32Array(n);
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  const sq = (x) => x * x;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + sq(q)) - (f[v[k]] + sq(v[k]))) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + sq(q)) - (f[v[k]] + sq(v[k]))) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = sq(q - v[k]) + f[v[k]]; }
  return d;
}

// --- EDT 2D ---
function edt2d(bin, w, h) {
  const tmp = new Float32Array(w * h);
  const f = new Float32Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = bin[y * w + x];
    const d = edt1d(f, w);
    for (let x = 0; x < w; x++) tmp[y * w + x] = d[x];
  }
  const out = new Float32Array(w * h);
  const g = new Float32Array(h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) g[y] = tmp[y * w + x];
    const d = edt1d(g, h);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  return out;
}

function signedDistanceInside(gray, w, h) {
  const INF = 1e12;
  const bin = new Float32Array(w * h);
  for (let i = 0; i < bin.length; i++) bin[i] = (gray[i] > 0.5 ? INF : 0);
  const d2 = edt2d(bin, w, h);
  const dist = new Float32Array(w * h);
  for (let i = 0; i < dist.length; i++) dist[i] = Math.sqrt(d2[i]);
  return dist;
}

function shadeImageSDF(baseCtx, maskCtx, {
  bevelPx = 16,
  strength = 1.3,
  light = [-0.9, -0.55, 0.35],
  ao = 0.18,
  cylK = 0.38,
  cylCX = 0.50
} = {}) {
  const w = baseCtx.canvas.width, h = baseCtx.canvas.height;

  // 1) máscara y SDF
  const blur = Math.max(1, Math.floor(w / 400));
  const tC = makeCanvas(w, h), tX = tC.getContext('2d', { willReadFrequently: true });
  tX.filter = `blur(${blur}px)`; tX.drawImage(maskCtx.canvas, 0, 0);
  const { arr: gray } = getGrayWithAlpha(tX.getImageData(0, 0, w, h));
  const sdf = signedDistanceInside(gray, w, h);

  const R = Math.max(1, bevelPx);
  const H = new Float32Array(w * h);
  for (let i = 0; i < H.length; i++) {
    const q = Math.max(0, Math.min(1, (R - sdf[i]) / R));
    H[i] = Math.pow(q, 0.6);
  }

  // 2) normales (bisel + cilindro)
  const nx = new Float32Array(w * h), ny = new Float32Array(w * h), nz = new Float32Array(w * h);
  const cxPix = Math.floor(w * cylCX);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      let X = -(H[i + 1] - H[i - 1]) * 0.5 * strength;
      let Y = -(H[i + w] - H[i - w]) * 0.5 * strength;
      let Z = 1.0;
      const u = Math.max(-1, Math.min(1, ((x - cxPix) / w) / cylK));
      const cX = -u, cY = 0.0, cZ = Math.sqrt(Math.max(0, 1 - cX * cX));
      const m = Math.pow(gray[i], 0.7);
      X = (1 - m) * cX + m * X; Y = (1 - m) * cY + m * Y; Z = (1 - m) * cZ + m * Z;
      const L = Math.hypot(X, Y, Z) || 1; nx[i] = X / L; ny[i] = Y / L; nz[i] = Z / L;
    }
  }

  // 3) iluminación dentro de la máscara
  const Llen = Math.hypot(light[0], light[1], light[2]) || 1;
  const Lx = light[0] / Llen, Ly = light[1] / Llen, Lz = light[2] / Llen;
  let Hx = Lx, Hy = Ly, Hz = Lz + 1; { const s = Math.hypot(Hx, Hy, Hz) || 1; Hx /= s; Hy /= s; Hz /= s; }
  const baseline = Lz;

  const base = baseCtx.getImageData(0, 0, w, h), out = baseCtx.createImageData(w, h);
  const bd = base.data, od = out.data;

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

  // 4) highlight y sombra desplazados, enmascarados
  const depth = Math.max(8, Math.floor(w / 160));
  const blurB = Math.max(1, Math.floor(w / 400));

  const mm = makeCanvas(w, h), mx = mm.getContext('2d'); mx.putImageData(tX.getImageData(0, 0, w, h), 0, 0);
  const dil = makeCanvas(w, h), dx = dil.getContext('2d');
  dx.filter = 'blur(1px)'; dx.drawImage(mm, 0, 0);

  const edgeOuter = makeCanvas(w, h), ex = edgeOuter.getContext('2d');
  ex.drawImage(dx.canvas, 0, 0);
  ex.globalCompositeOperation = 'destination-out';
  ex.drawImage(mm, 0, 0);
  ex.globalCompositeOperation = 'source-over';
  ex.filter = `blur(${blurB}px)`;

  const hi = makeCanvas(w, h), hix = hi.getContext('2d');
  hix.drawImage(edgeOuter, 0, 0);
  hix.globalCompositeOperation = 'source-in';
  hix.fillStyle = 'rgba(255,255,255,0.35)';
  hix.fillRect(0, 0, w, h);

  const sh = makeCanvas(w, h), shx = sh.getContext('2d');
  shx.drawImage(edgeOuter, 0, 0);
  shx.globalCompositeOperation = 'source-in';
  shx.fillStyle = 'rgba(0,0,0,0.45)';
  shx.fillRect(0, 0, w, h);

  baseCtx.drawImage(hi, -depth, -depth);
  baseCtx.drawImage(sh,  depth,  depth);
}

// ---- dibuja logo blanco centrado ----
function drawLogoMaskFullsize(mctx, logoImg, W, H, logoScaleW, logoCenter) {
  mctx.clearRect(0, 0, W, H);
  const targetW = Math.max(4, Math.floor(W * logoScaleW));
  const ratio = logoImg.naturalHeight > 0 ? (logoImg.naturalHeight / logoImg.naturalWidth) : 1;
  const targetH = Math.max(4, Math.floor(targetW * ratio));
  const cx = Math.floor(W * logoCenter[0]);
  const cy = Math.floor(H * logoCenter[1]);
  mctx.drawImage(logoImg, cx - targetW / 2, cy - targetH / 2, targetW, targetH);
  mctx.globalCompositeOperation = 'source-in';
  mctx.fillStyle = '#ffffff';
  mctx.fillRect(0, 0, W, H);
  mctx.globalCompositeOperation = 'source-over';
}

export async function applyRelief2DFromURLs(
  baseUrl,
  logoUrl,
  {
    logoScaleW = 0.36,
    logoCenter = [0.48, 0.46],
    bevelPx = 16,
    strength = 1.3,
    light = [-0.9, -0.55, 0.35],
    ao = 0.18,
    cylK = 0.38,
    cylCX = 0.50
  } = {}
) {
  const baseImg = await loadImage(baseUrl);
  const W = baseImg.naturalWidth, H = baseImg.naturalHeight;

  const baseC = makeCanvas(W, H);
  const baseX = baseC.getContext('2d', { willReadFrequently: true });
  baseX.drawImage(baseImg, 0, 0, W, H);

  const logoImg = await loadImage(logoUrl);
  const maskC = makeCanvas(W, H);
  const mctx = maskC.getContext('2d', { willReadFrequently: true });
  drawLogoMaskFullsize(mctx, logoImg, W, H, logoScaleW, logoCenter);

  shadeImageSDF(baseX, mctx, { bevelPx, strength, light, ao, cylK, cylCX });

  return baseC.toDataURL('image/png');
}
