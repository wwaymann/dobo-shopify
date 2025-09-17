// /lib/normalMap.js
export async function rasterizeToCanvas(src, size=1024, blurPx=8){
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");

  // intenta vía fetch -> blob -> ImageBitmap
  try {
    const res = await fetch(src, { cache: "no-cache" });
    if (!res.ok) throw new Error("fetch " + res.status);
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    ctx.clearRect(0,0,size,size);
    ctx.drawImage(bmp, 0,0, size,size);
  } catch {
    // fallback <img> mismo origen, sin crossOrigin
    await new Promise((resolve, reject)=>{
      const img = new Image();
      img.onload = ()=>{ ctx.drawImage(img,0,0,size,size); resolve(); };
      img.onerror = reject;
      img.src = src;
    });
  }

  // aplicar blur real en canvas temporal
  const t = document.createElement("canvas");
  t.width = t.height = size;
  const tctx = t.getContext("2d");
  tctx.filter = `blur(${blurPx}px)`;
  tctx.drawImage(c, 0, 0, size, size);
  const blurred = tctx.getImageData(0,0,size,size);
  return { canvas: c, imageData: blurred };
}

function sobelNormals(imageData, strength=1.0){
  const { width:w, height:h, data } = imageData;
  const out = new ImageData(w,h);
  const lum = new Float32Array(w*h);
  for (let i=0,p=0;i<data.length;i+=4,p++){
    const r=data[i], g=data[i+1], b=data[i+2], a=data[i+3];
    lum[p] = (0.2126*r + 0.7152*g + 0.0722*b) * (a/255);
  }
  const gxK=[-1,0,1,-2,0,2,-1,0,1], gyK=[-1,-2,-1,0,0,0,1,2,1];
  for (let y=1;y<h-1;y++){
    for (let x=1;x<w-1;x++){
      let gx=0, gy=0, k=0;
      for (let j=-1;j<=1;j++){
        for (let i=-1;i<=1;i++,k++){
          const v = lum[(y+j)*w + (x+i)];
          gx += v*gxK[k]; gy += v*gyK[k];
        }
      }
      const nx=-gx*strength, ny=-gy*strength, nz=1;
      const len=Math.hypot(nx,ny,nz)||1;
      const o=(y*w+x)*4;
      out.data[o]   = Math.round((nx/len)*127+128);
      out.data[o+1] = Math.round((ny/len)*127+128);
      out.data[o+2] = Math.round((nz/len)*127+128);
      out.data[o+3] = 255;
    }
  }
  return out;
}

export async function normalMapFromImage(src,{size=1024,blurPx=8,strength=2.0}={}){
  const {canvas, imageData} = await rasterizeToCanvas(src, size, blurPx);
  const ctx = canvas.getContext("2d");
  const nm = sobelNormals(imageData, strength);
  ctx.putImageData(nm, 0, 0);
  return canvas.toDataURL("image/png");
}
