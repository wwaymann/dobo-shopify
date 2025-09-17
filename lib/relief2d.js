// Relieve 2D por iluminación sobre máscara (sin 3D)
// Uso principal: applyRelief2DFromURLs('/pot.jpg','/logo-dobo.png',opts)

async function loadImage(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  return img;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function drawCentered(ctx, img, cx, cy, sw, sh) {
  ctx.drawImage(img, cx - sw/2, cy - sh/2, sw, sh);
}

function getGrayWithAlpha(imgData) {
  const { data, width, height } = imgData;
  const out = new Float32Array(width * height);
  for (let i=0, p=0; i<data.length; i+=4, p++) {
    const r=data[i], g=data[i+1], b=data[i+2], a=data[i+3];
    const lum = 0.2126*r + 0.7152*g + 0.0722*b;
    out[p] = (lum/255) * (a/255);
  }
  return { arr: out, width, height };
}

function sobel(gray, w, h) {
  const gxK = [-1,0,1,-2,0,2,-1,0,1];
  const gyK = [-1,-2,-1,0,0,0,1,2,1];
  const pad = 1;
  const outX = new Float32Array(w*h);
  const outY = new Float32Array(w*h);

  // bordes replicados
  const at = (x,y) => {
    x = Math.max(0, Math.min(w-1,x));
    y = Math.max(0, Math.min(h-1,y));
    return gray[y*w + x];
  };

  for (let y=0; y<h; y++){
    for (let x=0; x<w; x++){
      let gx=0, gy=0, k=0;
      for (let j=-1;j<=1;j++){
        for (let i=-1;i<=1;i++,k++){
          const v = at(x+i,y+j);
          gx += v * gxK[k]; gy += v * gyK[k];
        }
      }
      const o = y*w + x;
      outX[o] = gx; outY[o] = gy;
    }
  }
  return { gx: outX, gy: outY };
}

function shadeImage(baseCtx, maskCtx, { strength=3.2, light=[-0.9,-0.6,0.35], ao=0.25 }) {
  const w = baseCtx.canvas.width, h = baseCtx.canvas.height;

  // Mask suavizada para bisel
  const blurPx = Math.max(1, Math.floor(w/400));
  maskCtx.filter = `blur(${blurPx}px)`;
  const blurred = makeCanvas(w,h).getContext('2d',{willReadFrequently:true});
  blurred.drawImage(maskCtx.canvas,0,0);
  const mData = blurred.getImageData(0,0,w,h);
  const { arr: gray } = getGrayWithAlpha(mData);

  // Normales 2D (Sobel)
  const { gx, gy } = sobel(gray, w, h);
  const nx = new Float32Array(w*h);
  const ny = new Float32Array(w*h);
  const nz = new Float32Array(w*h);
  for (let i=0;i<nx.length;i++){
    const x = -gx[i]*strength;
    const y = -gy[i]*strength;
    const z = 1.0;
    const len = Math.hypot(x,y,z) || 1;
    nx[i]=x/len; ny[i]=y/len; nz[i]=z/len;
  }

  // Luz
  const Lx=light[0], Ly=light[1], Lz=light[2];
  const Llen = Math.hypot(Lx,Ly,Lz)||1;
  const lx=Lx/Llen, ly=Ly/Llen, lz=Lz/Llen;

  // Especular leve para cresta
  const Hx = lx, Hy = ly, Hz = (lz+1); // half-vector aprox con vista [0,0,1]
  const Hlen = Math.hypot(Hx,Hy,Hz)||1;
  const hx=Hx/Hlen, hy=Hy/Hlen, hz=Hz/Hlen;

  const baseData = baseCtx.getImageData(0,0,w,h);
  const outData = baseCtx.createImageData(w,h);
  const bd = baseData.data, od = outData.data;

  for (let i=0,p=0;i<bd.length;i+=4,p++){
    const r=bd[i], g=bd[i+1], b=bd[i+2];

    const m = gray[p];                 // 0..1
    if (m <= 0.001) {                  // fuera del logo
      od[i]=r; od[i+1]=g; od[i+2]=b; od[i+3]=255;
      continue;
    }

    // difuso respecto a plano
    const d = nx[p]*lx + ny[p]*ly + nz[p]*lz;
    const baseline = lz;
    const delta = d - baseline;        // +/- alrededor del plano
    const k = 1.2;                     // intensidad difusa
    let fr = r*(1 + k*delta);
    let fg = g*(1 + k*delta);
    let fb = b*(1 + k*delta);

    // especular en borde
    const spec = Math.max(nx[p]*hx + ny[p]*hy + nz[p]*hz, 0);
    const shine = Math.pow(spec, 32) * 220; // pico
    fr = Math.min(255, fr + shine*m);
    fg = Math.min(255, fg + shine*m);
    fb = Math.min(255, fb + shine*m);

    // AO leve
    const aoDark = 1 - ao*m;
    od[i]  = Math.max(0, Math.min(255, fr*aoDark));
    od[i+1]= Math.max(0, Math.min(255, fg*aoDark));
    od[i+2]= Math.max(0, Math.min(255, fb*aoDark));
    od[i+3]= 255;
  }

  baseCtx.putImageData(outData,0,0);
}

export async function applyRelief2DFromURLs(baseUrl, logoUrl, {
  logoScaleW = 0.34,             // ancho del logo relativo al ancho de la foto
  logoCenter = [0.48, 0.44],     // centro (x,y) relativo [0..1]
  strength = 3.2,
  light = [-0.9, -0.6, 0.35],
  ao = 0.25
} = {}) {

  const baseImg = await loadImage(baseUrl);
  const W = baseImg.naturalWidth, H = baseImg.naturalHeight;

  // canvas base
  const baseC = makeCanvas(W,H);
  const baseX = baseC.getContext('2d');
  baseX.drawImage(baseImg, 0, 0, W, H);

  // máscara del logo a tamaño de la foto
  const logoImg = await loadImage(logoUrl);
  const maskC = makeCanvas(W,H);
  const mctx = maskC.getContext('2d');
  mctx.clearRect(0,0,W,H);

  const targetW = Math.max(4, Math.floor(W*logoScaleW));
  const ratio = logoImg.naturalHeight > 0 ? (logoImg.naturalHeight / logoImg.naturalWidth) : 1;
  const targetH = Math.max(4, Math.floor(targetW * ratio));
  const cx = Math.floor(W * logoCenter[0]);
  const cy = Math.floor(H * logoCenter[1]);

  // dibuja el logo en blanco sobre transparente
  mctx.save();
  mctx.drawImage(logoImg, cx - targetW/2, cy - targetH/2, targetW, targetH);
  mctx.globalCompositeOperation = 'source-in';
  mctx.fillStyle = '#ffffff';
  mctx.fillRect(0,0,W,H);
  mctx.restore();

  // iluminación 2D
  shadeImage(baseX, mctx, { strength, light, ao });

  return baseC.toDataURL('image/png'); // resultado
}
