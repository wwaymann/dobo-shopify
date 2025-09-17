function shadeImage(baseCtx, maskCtx, {
  strength=3.4,                 // profundidad del relieve del logo
  light=[-0.9,-0.6,0.35],       // luz desde arriba-izquierda
  ao=0.25,                      // oclusión ambiental leve
  cylK=0.42,                    // curvatura horizontal (cilindro)
  cylCX=0.50                    // centro de curvatura (0..1)
} = {}) {
  const w = baseCtx.canvas.width, h = baseCtx.canvas.height;

  // 1) Máscara suavizada y gradientes (Sobel)
  const blurPx = Math.max(1, Math.floor(w/400));
  const tmpC = document.createElement('canvas'); tmpC.width=w; tmpC.height=h;
  const tctx = tmpC.getContext('2d', { willReadFrequently:true });
  tctx.filter = `blur(${blurPx}px)`;
  tctx.drawImage(maskCtx.canvas,0,0);
  const mData = tctx.getImageData(0,0,w,h);
  const { arr: gray } = getGrayWithAlpha(mData);
  const { gx, gy } = sobel(gray, w, h);

  // 2) Normales del logo (Sobel) + normal cilíndrica de la maceta
  const lx=light[0], ly=light[1], lz=light[2];
  const Llen = Math.hypot(lx,ly,lz)||1; const Lx=lx/Llen, Ly=ly/Llen, Lz=lz/Llen;

  // Half-vector para especular simple con vista [0,0,1]
  let Hx=Lx, Hy=Ly, Hz=Lz+1; { const Lh=Math.hypot(Hx,Hy,Hz)||1; Hx/=Lh; Hy/=Lh; Hz/=Lh; }

  const baseData = baseCtx.getImageData(0,0,w,h);
  const outData  = baseCtx.createImageData(w,h);
  const bd=baseData.data, od=outData.data;

  // precompute edge mask para realzar borde
  const edgeMag = new Float32Array(w*h);
  for (let i=0;i<edgeMag.length;i++) edgeMag[i] = Math.min(1, Math.hypot(gx[i],gy[i])*2.0);

  const cxPix = Math.floor(w*cylCX);
  for (let y=0, p=0; y<h; y++){
    for (let x=0; x<w; x++, p++){
      const r=bd[p*4], g=bd[p*4+1], b=bd[p*4+2];
      const m = gray[p];            // 0..1 (zona del logo)

      if (m <= 0.001) { // fuera del logo: mantener
        od[p*4]=r; od[p*4+1]=g; od[p*4+2]=b; od[p*4+3]=255;
        continue;
      }

      // normal del logo por Sobel
      let nx = -gx[p]*strength, ny = -gy[p]*strength, nz = 1.0;
      // normal cilíndrica horizontal (simula curvatura de la maceta)
      const u = Math.max(-1, Math.min(1, ( (x - cxPix)/w )/cylK )); // -1..1
      const cnx = -u, cny = 0.0, cnz = Math.sqrt(Math.max(0, 1 - cnx*cnx));

      // mezcla: más peso al logo en el interior; en el borde deja algo de cilíndrica
      const mw = Math.pow(m, 0.7);
      nx = (1-mw)*cnx + mw*nx;
      ny = (1-mw)*cny + mw*ny;
      nz = (1-mw)*cnz + mw*nz;
      { const ln = Math.hypot(nx,ny,nz)||1; nx/=ln; ny/=ln; nz/=ln; }

      // 3) Difuso relativo al plano base
      const baseline = Lz; // dot de normal plana [0,0,1] con la luz
      const d = nx*Lx + ny*Ly + nz*Lz;
      const delta = d - baseline;
      const kd = 1.25; // intensidad difusa
      let fr = r*(1 + kd*delta);
      let fg = g*(1 + kd*delta);
      let fb = b*(1 + kd*delta);

      // 4) Especular concentrado en el borde (double-crest look)
      const spec = Math.max(nx*Hx + ny*Hy + nz*Hz, 0);
      const crest = Math.pow(spec, 48) * 255 * Math.min(1, edgeMag[p]*1.2);
      fr = Math.min(255, fr + crest);
      fg = Math.min(255, fg + crest);
      fb = Math.min(255, fb + crest);

      // 5) AO leve dentro del logo
      const aoDark = 1 - ao*m;
      fr *= aoDark; fg *= aoDark; fb *= aoDark;

      // 6) Grain muy sutil para fundir
      const noise = (Math.random()-0.5)*6;
      od[p*4]   = Math.max(0, Math.min(255, fr + noise));
      od[p*4+1] = Math.max(0, Math.min(255, fg + noise));
      od[p*4+2] = Math.max(0, Math.min(255, fb + noise));
      od[p*4+3] = 255;
    }
  }

  baseCtx.putImageData(outData,0,0);
}
