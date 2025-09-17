// Relieve 2D con SDF (campo de distancias) — sin Three.js

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
function shadeImageSDF(baseCtx, maskCtx, {
  bevelPx = 12,                  // radio del bisel en píxeles
  strength = 1.0,                // escala de normales del bisel
  light   = [-0.95,-0.55,0.30],  // luz
  ao      = 0.22,
  cylK    = 0.40,
  cylCX   = 0.50
} = {}){
  const w=baseCtx.canvas.width, h=baseCtx.canvas.height;

  // máscara suavizada -> binaria
  const blur=Math.max(1, Math.floor(w/400));
  const tC=makeCanvas(w,h), tX=tC.getContext('2d',{willReadFrequently:true});
  tX.filter=`blur(${blur}px)`; tX.drawImage(maskCtx.canvas,0,0);
  const {arr:gray}=getGrayWithAlpha(tX.getImageData(0,0,w,h));

  // SDF interior (distancia al borde dentro de la forma)
  const sdf=signedDistanceInside(gray,w,h);

  // altura radial del bisel (perfil redondeado)
  const H=new Float32Array(w*h);
  const R=Math.max(1, bevelPx);
  for(let i=0;i<H.length;i++){
    const q=Math.max(0, Math.min(1, (R - sdf[i])/R)); // 1 en borde interior → 0 en centro
    // perfil suave tipo “round bevel”
    H[i]=Math.pow(q, 0.6);
  }

  // normales del bisel (derivadas centrales sobre H)
  const nx=new Float32Array(w*h), ny=new Float32Array(w*h), nz=new Float32Array(w*h);
  const s=strength;
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      const i=y*w+x;
      const dhdx=(H[i+1]-H[i-1])*0.5;
      const dhdy=(H[i+w]-H[i-w])*0.5;
      let X=-dhdx*s, Y=-dhdy*s, Z=1.0;
      // mezcla con normal cilíndrica
      const u=Math.max(-1, Math.min(1, ((x - Math.floor(w*cylCX))/w)/cylK));
      const cX=-u, cY=0.0, cZ=Math.sqrt(Math.max(0,1-cX*cX));
      const m = Math.pow(gray[i],0.7);
      X=(1-m)*cX + m*X; Y=(1-m)*cY + m*Y; Z=(1-m)*cZ + m*Z;
      const L=Math.hypot(X,Y,Z)||1; nx[i]=X/L; ny[i]=Y/L; nz[i]=Z/L;
    }
  }

  // luz y half-vector
  const Llen=Math.hypot(light[0],light[1],light[2])||1;
  const Lx=light[0]/Llen, Ly=light[1]/Llen, Lz=light[2]/Llen;
  let Hx=Lx, Hy=Ly, Hz=Lz+1; { const ll=Math.hypot(Hx,Hy,Hz)||1; Hx/=ll; Hy/=ll; Hz/=ll; }
  const baseline=Lz;

  const base=baseCtx.getImageData(0,0,w,h), out=baseCtx.createImageData(w,h);
  const bd=base.data, od=out.data;

  // máscara de borde para pico especular
  const edge=new Float32Array(w*h);
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      const i=y*w+x;
      const gx=Math.abs(H[i+1]-H[i-1]);
      const gy=Math.abs(H[i+w]-H[i-w]);
      edge[i]=Math.min(1, (gx+gy)*8.0);
    }
  }

  for(let y=0,p=0;y<h;y++){
    for(let x=0;x<w;x++,p++){
      const m=gray[p];
      const r=bd[p*4], g=bd[p*4+1], b=bd[p*4+2];
      if(m<=0.001){ od[p*4]=r; od[p*4+1]=g; od[p*4+2]=b; od[p*4+3]=255; continue; }

      const d = nx[p]*Lx + ny[p]*Ly + nz[p]*Lz;
      const delta = d - baseline;
      const kd = 1.25;
      let fr=r*(1+kd*delta), fg=g*(1+kd*delta), fb=b*(1+kd*delta);

      const spec = Math.max(nx[p]*Hx + ny[p]*Hy + nz[p]*Hz, 0);
      const crest = Math.pow(spec, 48) * 255 * Math.min(1, edge[p]*1.2);
      fr=Math.min(255, fr+crest); fg=Math.min(255, fg+crest); fb=Math.min(255, fb+crest);

      const aoDark = 1 - ao*m;
      od[p*4]  = Math.max(0, Math.min(255, fr*aoDark));
      od[p*4+1]= Math.max(0, Math.min(255, fg*aoDark));
      od[p*4+2]= Math.max(0, Math.min(255, fb*aoDark));
      od[p*4+3]=255;
    }
  }
  baseCtx.putImageData(out,0,0);

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
