// normalMap.js
// Convierte un PNG/SVG monocromo a normal map (DataURL PNG)

export async function rasterizeToCanvas(src, size=1024, blurPx=8) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();

  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.clearRect(0,0,size,size);
  ctx.drawImage(img, 0,0, size,size);

  // suaviza bordes para bisel
  ctx.filter = `blur(${blurPx}px)`;
  const blurred = ctx.getImageData(0,0,size,size);
  return {canvas:c, imageData:blurred};
}

// Sobel en X/Y sobre luminancia para derivadas
function sobelNormals(imageData, strength=1.0) {
  const { width:w, height:h, data } = imageData;
  const out = new ImageData(w,h);
  const lum = new Float32Array(w*h);

  // luminancia
  for (let i=0, p=0; i<data.length; i+=4, p++){
    const r=data[i], g=data[i+1], b=data[i+2], a=data[i+3];
    lum[p] = (0.2126*r + 0.7152*g + 0.0722*b) * (a/255);
  }

  const gxK = [-1,0,1,-2,0,2,-1,0,1];
  const gyK = [-1,-2,-1,0,0,0,1,2,1];

  for (let y=1; y<h-1; y++){
    for (let x=1; x<w-1; x++){
      let gx=0, gy=0, k=0;
      for (let j=-1;j<=1;j++){
        for (let i=-1;i<=1;i++,k++){
          const v = lum[(y+j)*w + (x+i)];
          gx += v * gxK[k];
          gy += v * gyK[k];
        }
      }
      // normal: (nx, ny, nz); nz constante
      const nx = -gx * strength;   // signo invierte sobre/bajo relieve
      const ny = -gy * strength;
      const nz = 1.0;
      // normalizar
      const len = Math.hypot(nx, ny, nz) || 1;
      const r = Math.round((nx/len)*127 + 128);
      const g = Math.round((ny/len)*127 + 128);
      const b = Math.round((nz/len)*127 + 128);
      const o = (y*w + x) * 4;
      out.data[o] = r; out.data[o+1] = g; out.data[o+2] = b; out.data[o+3] = 255;
    }
  }
  return out;
}

export async function normalMapFromImage(src, {size=1024, blurPx=8, strength=2.0} = {}) {
  const {canvas, imageData} = await rasterizeToCanvas(src, size, blurPx);
  const ctx = canvas.getContext("2d");
  const nm = sobelNormals(imageData, strength);
  ctx.putImageData(nm, 0, 0);
  return canvas.toDataURL("image/png");
}
