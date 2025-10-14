// bin/apply-patch.js
const fs = require('fs'); const path = require('path');
const roots = ['.', 'src', 'app'];
const hpCandidates = []; for (const r of roots) hpCandidates.push(path.join(r, 'features', 'home', 'HomePage.jsx'));
const appCandidates = roots.map(r => path.join(r, 'pages', '_app.js'));
function readIfExists(p){try{return fs.readFileSync(p,'utf8')}catch{return null}}
function ensureImport(src, imp){ if(src.includes(imp)) return src; const ls=src.split(/\r?\n/); let i=0; while(i<ls.length && ls[i].startsWith('import ')) i++; ls.splice(i,0,imp); return ls.join('\n');}

function patchHomePage(src){
  let out=src;
  out = ensureImport(out, `import { getShopDomain, toNumericId, createDesignProductSafe } from "@/lib/checkoutHelpers";`);
  out = out.replace(/postCart\(\s*SHOP_DOMAIN\s*,/g,'postCart(getShopDomain(),');
  out = out.replace(/postCart\(\s*getShopDomain\(\)\s*,\s*([^\s,)\n]+)\s*,/g,(m,id)=> m.replace(id,`toNumericId(${id})`));
  out = out.replace(/async function buyNow\([^)]*\)\s*\{[\s\S]*?\}\s*\n/, `async function buyNow(){try{const attrs=await prepareDesignAttributes();const potPrice=selectedPotVariant?.price?num(selectedPotVariant.price):firstVariantPrice(pots[selectedPotIndex]);const plantPrice=productMin(plants[selectedPlantIndex]);const basePrice=Math.max(1,Math.round((potPrice+plantPrice)*quantity));const priceStr=String(basePrice);const dp=await createDesignProductSafe({title:\\`DOBO \\${plants[selectedPlantIndex]?.title||"Planta"} + \\${pots[selectedPotIndex]?.title||"Maceta"}\\`,previewUrl:attrs.find(a=>a.key==="__DesignPreview")?.value||attrs.find(a=>a.key==="_DesignPreview")?.value||"",price:priceStr,color:selectedColor||"Único",size:activeSize||"Único",designId:attrs.find(a=>a.key==="__DesignId")?.value||attrs.find(a=>a.key==="_DesignId")?.value||\\`dobo-\\${Date.now()}\\`,plantTitle:plants[selectedPlantIndex]?.title||"Planta",potTitle:pots[selectedPotIndex]?.title||"Maceta"});const accIds=getAccessoryVariantIds();const shop=getShopDomain();const main=toNumericId(dp?.variantId||selectedVariant?.id);if(!shop){alert("No se detectó el dominio de Shopify");return;}if(!main){alert("Variante inválida");return;}postCart(shop,main,quantity,attrs,accIds,"/checkout");}catch(e){console.warn("GraphQL falló; usando fallback al variante seleccionado:",e);const attrs=await prepareDesignAttributes();const accIds=getAccessoryVariantIds();const shop=getShopDomain();const main=toNumericId(selectedVariant?.id);if(!shop){alert("No se detectó el dominio de Shopify");return;}if(!main){alert("Selecciona una maceta válida");return;}postCart(shop,main,quantity,attrs,accIds,"/checkout");}}
`);
  out = out.replace(/html2canvas\(\s*el\s*,\s*\{([\s\S]*?)\}\s*\)/m,(m,inner)=> inner.includes('windowWidth')?m: m.replace(inner, inner.replace(/\}\s*$/,'') + ',\n  windowWidth: el.scrollWidth,\n  windowHeight: el.scrollHeight\n}'));
  return out;
}
function patchApp(src){ return ensureImport(src, 'import "@/lib/canvasWillReadFrequently";'); }

(function main(){
  fs.mkdirSync('lib',{recursive:true});
  fs.copyFileSync(path.join(__dirname,'..','lib','canvasWillReadFrequently.js'),'lib/canvasWillReadFrequently.js');
  fs.copyFileSync(path.join(__dirname,'..','lib','checkoutHelpers.js'),'lib/checkoutHelpers.js');

  let ok=false;
  for (const p of hpCandidates){ const s=readIfExists(p); if(!s) continue; const o=patchHomePage(s); if(o!==s) fs.writeFileSync(p,o,'utf8'); console.log('Patched:',p); ok=true; break; }
  if(!ok) console.warn('No se encontró features/home/HomePage.jsx. Ajusta rutas en bin/apply-patch.js.');

  let aok=false;
  for (const p of appCandidates){ const s=readIfExists(p); if(!s) continue; const o=patchApp(s); if(o!==s) fs.writeFileSync(p,o,'utf8'); console.log('Patched:',p); aok=true; break; }
  if(!aok){ const p='pages/_app.js'; fs.mkdirSync('pages',{recursive:true}); fs.writeFileSync(p,'import "@/lib/canvasWillReadFrequently";\nexport default function App({Component,pageProps}){return <Component {...pageProps}/>;}','utf8'); console.log('Created:',p); }
  console.log("\n✅ Listo. Ejecuta: node bin/apply-patch.js");
})();
