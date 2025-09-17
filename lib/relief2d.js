// Relieve 2D sobre una foto, sin 3D.
// Uso típico: applyRelief2DFromURLs('/pot.jpg','/logo-dobo.png', { ...opts })

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // seguro si sirves desde el mismo dominio
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
    if (typeof img.decode === "function") {
      img.decode().then(() => resolve(img)).catch(() => {/* onload cubrirá */});
    }
  });
}

function getGrayWithAlpha(imgData) {
  const { data, width, height } = imgData;
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    out[p] = (lum / 255) * (a / 255);
  }
  return { arr: out, width, height };
}

function sobel(gray, w, h) {
  const gxK = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gyK = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const outX = new Float32Array(w * h);
  const outY = new Float32Array(w * h);
  const at = (x, y) => {
    x = Math.max(0, Math.min(w - 1, x));
    y = Math.max(0, Math.min(h - 1, y));
    return gray[y * w + x];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let gx = 0, gy = 0, k = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++, k++) {
          const v = at(x + i, y + j);
          gx += v * gxK[k]; gy += v * gyK[k];
        }
      }
      const o = y * w + x;
      outX[o] = gx; outY[o] = gy;
    }
  }
  return { gx: outX, gy: outY };
}

function shadeImage(baseCtx, maskCtx, {
  strength = 3.4,                 // profundidad del relieve del logo
  light = [-0.95, -0.55, 0.30],   // luz desde arriba-izquierda
  ao = 0.22,                      // oclusión ambiental leve
  cylK = 0.40,                    // curvatura horizontal (cilindro)
  cylCX = 0.50                    // centro de curvatura (0..1)
} = {}) {
  const w = baseCtx.canvas.width, h = baseCtx.canvas.height;

  // 1) Máscara suavizada y gradientes
  const blurPx = Math.max(1, Math.floor(w / 400));
  const tmpC = makeCanvas(w, h);
  const tctx = tmpC.getContext('2d', { willReadFrequently: true });
  tctx.filter = `blur(${blurPx}px)`;
  tctx.drawImage(maskCtx.canvas, 0, 0);
  const mData = tctx.getImageData(0, 0, w, h);
  const { arr: gray } = getGrayWithAlpha(mData);
  const { gx, gy } = sobel(gray, w, h);

  // 2) Luz normalizada y half-vector para especular
  const Lx0 = light[0], Ly0 = light[1], Lz0 = light[2];
  const Llen = Math.hypot(Lx0, Ly0, Lz0) || 1;
  const Lx = Lx0 / Llen, Ly = Ly0 / Llen, Lz = Lz0 / Llen;
  let Hx = Lx, Hy = Ly, Hz = Lz + 1; // vista ~[0,0,1]
  const Hlen = Math.hypot(Hx, Hy, Hz) || 1; Hx /= Hlen; Hy /= Hlen; Hz /= Hlen;

  const baseData = baseCtx.getImageData(0, 0, w, h);
  const outData = baseCtx.createImageData(w, h);
  const bd = baseData.data, od = outData.data;

  // Fuerte especular en borde
  const edgeMag = new Float32Array(w * h);
  for (let i = 0; i < edgeMag.length; i++) {
    edgeMag[i] = Math.min(1, Math.hypot(gx[i], gy[i]) * 2.0);
  }

  const cxPix = Math.floor(w * cylCX);

  for (let y = 0, p = 0; y < h; y++) {
    for (let x = 0; x < w; x++, p++) {
      const r = bd[p * 4], g = bd[p * 4 + 1], b = bd[p * 4 + 2];
      const m = gray[p]; // 0..1

      if (m <= 0.001) {
        od[p * 4] = r; od[p * 4 + 1] = g; od[p * 4 + 2] = b; od[p * 4 + 3] = 255;
        continue;
      }

      // normal del logo (Sobel)
      let nx = -gx[p] * strength, ny = -gy[p] * strength, nz = 1.0;

      // normal cilíndrica para envolver sobre la maceta
      const u = Math.max(-1, Math.min(1, ((x - cxPix) / w) / cylK)); // -1..1
      const cnx = -u, cny = 0.0, cnz = Math.sqrt(Math.max(0, 1 - cnx * cnx));

      // mezcla: logo dentro, cilindro en borde
      const mw = Math.pow(m, 0.7);
      nx = (1 - mw) * cnx + mw * nx;
      ny = (1 - mw) * cny + mw * ny;
      nz = (1 - mw) * cnz + mw * nz;
      { const ln = Math.hypot(nx, ny, nz) || 1; nx /= ln; ny /= ln; nz /= ln; }

      // 3) Difuso relativo a plano base
      const baseline = Lz;
      const d = nx * Lx + ny * Ly + nz * Lz;
      const delta = d - baseline;
      const kd = 1.25;
      let fr = r * (1 + kd * delta);
      let fg = g * (1 + kd * delta);
      let fb = b * (1 + kd * delta);

      // 4) Especular concentrado en el borde
      const spec = Math.max(nx * Hx + ny * Hy + nz * Hz, 0);
      const crest = Math.pow(spec, 48) * 255 * Math.min(1, edgeMag[p] * 1.2);
      fr = Math.min(255, fr + crest);
      fg = Math.min(255, fg + crest);
      fb = Math.min(255, fb + crest);

      // 5) AO leve
      const aoDark = 1 - ao * m;
      fr *= aoDark; fg *= aoDark; fb *= aoDark;

      // 6) Grain sutil
      const noise = (Math.random() - 0.5) * 6;
      od[p * 4] = Math.max(0, Math.min(255, fr + noise));
      od[p * 4 + 1] = Math.max(0, Math.min(255, fg + noise));
      od[p * 4 + 2] = Math.max(0, Math.min(255, fb + noise));
      od[p * 4 + 3] = 255;
    }
  }

  baseCtx.putImageData(outData, 0, 0);
}

// Dibuja el logo en blanco en un canvas máscara, centrado por posición y escala
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
    logoScaleW = 0.36,           // ancho relativo del logo
    logoCenter = [0.48, 0.46],   // centro [x,y] relativo 0..1
    strength = 3.4,
    light = [-0.95, -0.55, 0.30],
    ao = 0.22,
    cylK = 0.40,
    cylCX = 0.50
  } = {}
) {
  const baseImg = await loadImage(baseUrl);
  const W = baseImg.naturalWidth, H = baseImg.naturalHeight;

  // canvas base
  const baseC = makeCanvas(W, H);
  const baseX = baseC.getContext('2d', { willReadFrequently: true });
  baseX.drawImage(baseImg, 0, 0, W, H);

  // máscara del logo al tamaño de la foto
  const logoImg = await loadImage(logoUrl);
  const maskC = makeCanvas(W, H);
  const mctx = maskC.getContext('2d', { willReadFrequently: true });
  drawLogoMaskFullsize(mctx, logoImg, W, H, logoScaleW, logoCenter);

  // sombreado 2D
  shadeImage(baseX, mctx, { strength, light, ao, cylK, cylCX });

  return baseC.toDataURL('image/png');
}
