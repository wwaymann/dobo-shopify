// Relieve 2D con SDF (campo de distancias) — sin Three.js
'use client';

function makeCanvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }

function loadImage(src){
  return new Promise((resolve,reject)=>{
    const img=new Image(); img.crossOrigin="anonymous";
    img.onload=()=>resolve(img); img.onerror=reject; img.src=src;
    if(typeof img.decode==="function"){ img.decode().then(()=>resolve(img)).catch(()=>{}); }
  });
}

// ----- util: máscara gris (0..1) -----
function getGrayWithAlpha(imgData){
  const {data,width:w,height:h}=imgData;
  const out=new Float32Array(w*h);
  for(let i=0,p=0;i<data.length;i+=4,p++){
    const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
    const lum=0.2126*r+0.7152*g+0.0722*b;
    out[p]=(lum/255)*(a/255);
  }
  return {arr:out,width:w,height:h};
}

// ===== EDT de Felzenszwalb (distancia euclídea al cuadrado) =====
function edt1d(f,n){
  const v=new Int16Array(n), z=new Float32Array(n+1), d=new Float32Array(n);
  let k=0; v[0]=0; z[0]=-1e20; z[1]=1e20;
  function sq(x){return x*x;}
  for(let q=1;q<n;q++){
    let s=((f[q]+sq(q))-(f[v[k]]+sq(v[k])))/(2*q-2*v[k]);
    while(s<=z[k]){ k--; s=((f[q]+sq(q))-(f[v[k]]+sq(v[k])))/(2*q-2*v[k]); }
    k++; v[k]=q; z[k]=s; z[k+1]=1e20;
  }
  k=0;
  for(let q=0;q<n;q++){ while(z[k+1]<q) k++; d[q]=sq(q-v[k])+f[v[k]]; }
  return d;
}

function edt2d(bin,w,h){
  // bin: 0 en fondo, INF en interior
  const INF=1e12;
  // filas
  const tmp=new Float32Array(w*h);
  const f=new Float32Array(w);
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++) f[x]=bin[y*w+x];
    const d=edt1d(f,w);
    for(let x=0;x<w;x++) tmp[y*w+x]=d[x];
  }
  // columnas
  const out=new Float32Array(w*h);
  const g=new Float32Array(h);
  for(let x=0;x<w;x++){
    for(let y=0;y<h;y++) g[y]=tmp[y*w+x];
    const d=edt1d(g,h);
    for(let y=0;y<h;y++) out[y*w+x]=d[y];
  }
  return out;
}

// ----- genera SDF interior desde máscara (1=logo, 0=fondo) -----
function signedDistanceInside(gray,w,h){
  const INF=1e12;
  const bin=new Float32Array(w*h);
  for(let i=0;i<bin.length;i++) bin[i]= (gray[i]>0.5? INF : 0); // 0=fondo; INF=interior
  const d2=edt2d(bin,w,h); // dist^2 hasta el fondo → distancia al borde
  const dist=new Float32Array(w*h);
  for(let i=0;i<dist.length;i++) dist[i]=Math.sqrt(d2[i]);
  return dist; // solo interior
}

// ----- sombreado con SDF + curvatura cilíndrica -----
 shadeImageSDF

  // highlight/sombra desplazados para borde externo (leve)
  const depth=Math.max(8, Math.floor(w/160));
  const blurB=Math.max(1, Math.floor(w/400));
  const edgeC=makeCanvas(w,h), ex=edgeC.getContext('2d');
  const mm=makeCanvas(w,h), mx=mm.getContext('2d'); mx.putImageData(tX.getImageData(0,0,w,h),0,0);
  // bordes externo
  const dil=makeCanvas(w,h), dx=dil.getContext('2d'); dx.filter=`blur(${1}px)`; dx.drawImage(mm,0,0);
  ex.drawImage(dil,0,0); ex.globalCompositeOperation='destination-out'; ex.drawImage(mm,0,0); ex.globalCompositeOperation='source-over';
  ex.filter=`blur(${blurB}px)`;
  const hLayer=makeCanvas(w,h), hx=hLayer.getContext('2d');
  hx.fillStyle="rgba(255,255,255,0.35)"; hx.fillRect(0,0,w,h);
  baseCtx.globalCompositeOperation='lighter';
  baseCtx.drawImage(hLayer, -depth, -depth);
  const sLayer=makeCanvas(w,h), sx=sLayer.getContext('2d');
  sx.fillStyle="rgba(0,0,0,0.45)"; sx.fillRect(0,0,w,h);
  baseCtx.globalCompositeOperation='multiply';
  baseCtx.drawImage(sLayer, depth, depth);
  baseCtx.globalCompositeOperation='source-over';
}

// ---- dibuja logo blanco centrado ----
function drawLogoMaskFullsize(mctx, logoImg, W, H, logoScaleW, logoCenter){
  mctx.clearRect(0,0,W,H);
  const targetW=Math.max(4,Math.floor(W*logoScaleW));
  const ratio=logoImg.naturalHeight>0 ? (logoImg.naturalHeight/logoImg.naturalWidth) : 1;
  const targetH=Math.max(4,Math.floor(targetW*ratio));
  const cx=Math.floor(W*logoCenter[0]), cy=Math.floor(H*logoCenter[1]);
  mctx.drawImage(logoImg, cx-targetW/2, cy-targetH/2, targetW, targetH);
  mctx.globalCompositeOperation='source-in';
  mctx.fillStyle='#ffffff'; mctx.fillRect(0,0,W,H);
  mctx.globalCompositeOperation='source-over';
}

// API principal
export async function applyRelief2DFromURLs(
  baseUrl, logoUrl,
  { logoScaleW=0.36, logoCenter=[0.48,0.46],
    bevelPx=12, strength=1.0,
    light=[-0.95,-0.55,0.30], ao=0.22, cylK=0.40, cylCX=0.50 } = {}
){
  const baseImg=await loadImage(baseUrl);
  const W=baseImg.naturalWidth, H=baseImg.naturalHeight;

  const baseC=makeCanvas(W,H), baseX=baseC.getContext('2d',{willReadFrequently:true});
  baseX.drawImage(baseImg,0,0,W,H);

  const logoImg=await loadImage(logoUrl);
  const maskC=makeCanvas(W,H), mctx=maskC.getContext('2d',{willReadFrequently:true});
  drawLogoMaskFullsize(mctx, logoImg, W, H, logoScaleW, logoCenter);

  shadeImageSDF(baseX, mctx, { bevelPx, strength, light, ao, cylK, cylCX });

  return baseC.toDataURL('image/png');
}
