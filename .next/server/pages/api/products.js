"use strict";(()=>{var a={};a.id=583,a.ids=[583],a.modules={5600:a=>{a.exports=require("next/dist/compiled/next-server/pages-api.runtime.prod.js")},5801:(a,b,c)=>{c.r(b),c.d(b,{config:()=>q,default:()=>p,handler:()=>s});var d={};c.r(d),c.d(d,{default:()=>m});var e=c(9046),f=c(8667),g=c(3480),h=c(6435);let i=process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN||process.env.SHOPIFY_STORE_DOMAIN,j=process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN,k=process.env.SHOPIFY_STOREFRONT_API_VERSION||"2024-10",l=`https://${i}/api/${k}/graphql.json`;async function m(a,b){try{if("GET"!==a.method)return b.setHeader("Allow","GET"),b.status(405).json({error:"Method Not Allowed"});if(!i||!j)return b.status(500).json({error:"Faltan variables de entorno Shopify"});let c=function(a){if(!a)return null;let b=String(a).trim().toLowerCase();return"grande"===b||"g"===b?"Grande":"mediana"===b||"mediano"===b||"m"===b?"Mediana":["perque\xf1a","perquena","peque\xf1a","pequena","peque\xf1o","pequeno","p"].includes(b)?"Peque\xf1a":null}(a.query.size),d=function(a){if(!a)return null;let b=String(a).trim().toLowerCase();return["maceta","macetas","pot","pots"].includes(b)?"maceta":["planta","plantas","plant","plants"].includes(b)?"planta":["accesorio","accesorios","accessory","accessories"].includes(b)?"accesorio":null}(a.query.type),e=Number(a.query.first||60),f=[];c&&f.push(`tag:'${c}'`);let g="maceta"===d?"(tag:'maceta' OR tag:'macetas' OR product_type:'maceta' OR product_type:'macetas' OR title:maceta)":"planta"===d?"(tag:'planta' OR tag:'plantas' OR product_type:'planta' OR product_type:'plantas' OR title:planta)":"accesorio"===d?"(tag:'accesorio' OR tag:'accesorios' OR product_type:'accesorio' OR product_type:'accesorios' OR title:accesorio)":null;g&&f.push(g);let h=f.length?f.join(" AND "):null,k=`
      query ProductsByQuery($first: Int!, $search: String) {
        products(first: $first, query: $search) {
          edges {
            node {
              id
              handle
              title
              productType
              tags
              description
              descriptionHtml
              images(first: 1) { edges { node { url altText } } }
              variants(first: 50) {
                edges {
                  node {
                    id
                    image { url altText }
                    price { amount currencyCode }
                    compareAtPrice { amount currencyCode }
                    selectedOptions { name value }
                    availableForSale
                  }
                }
              }
              priceRange { minVariantPrice { amount currencyCode } }
            }
          }
        }
      }
    `,m=await fetch(l,{method:"POST",headers:{"Content-Type":"application/json","X-Shopify-Storefront-Access-Token":j},body:JSON.stringify({query:k,variables:{first:e,search:h}})}),n=await m.json();if(!m.ok||n.errors)return console.error("Shopify error",{status:m.status,errors:n.errors,search:h,endpoint:l}),b.status(502).json({error:"Error desde Shopify",status:m.status,details:n.errors||n,search:h});let o=n.data?.products?.edges?.map(({node:a})=>({id:a.id,handle:a.handle,title:a.title,productType:a.productType||"",tags:a.tags||[],description:a.description||"",descriptionHtml:a.descriptionHtml||"",image:a.images?.edges?.[0]?.node?.url||null,alt:a.images?.edges?.[0]?.node?.altText||null,variants:a.variants?.edges?.map(a=>({id:a.node.id,image:a.node.image?.url||null,hasOwnImage:!!a.node.image?.url,price:a.node.price||null,compareAtPrice:a.node.compareAtPrice||null,selectedOptions:a.node.selectedOptions||[],availableForSale:!!a.node.availableForSale}))||[],minPrice:a.priceRange?.minVariantPrice||null}))||[];return b.setHeader("Cache-Control","s-maxage=60, stale-while-revalidate=300"),b.status(200).json({size:c||null,type:d||null,count:o.length,products:o})}catch(a){return console.error("API /products exception",a),b.status(500).json({error:"Fallo de servidor",details:String(a)})}}var n=c(8112),o=c(8766);let p=(0,h.M)(d,"default"),q=(0,h.M)(d,"config"),r=new g.PagesAPIRouteModule({definition:{kind:f.A.PAGES_API,page:"/api/products",pathname:"/api/products",bundlePath:"",filename:""},userland:d,distDir:".next",projectDir:""});async function s(a,b,c){let d=await r.prepare(a,b,{srcPage:"/api/products"});if(!d){b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve());return}let{query:f,params:g,prerenderManifest:h}=d;try{let c=a.method||"GET",d=(0,n.getTracer)(),e=d.getActiveScopeSpan(),i=r.instrumentationOnRequestError.bind(r),j=async e=>r.render(a,b,{query:{...f,...g},params:g,allowedRevalidateHeaderKeys:void 0,multiZoneDraftMode:!0,trustHostHeader:void 0,previewProps:h.preview,propagateError:!1,dev:r.isDev,page:"/api/products",projectDir:"",onError:(...b)=>i(a,...b)}).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let f=d.getRootSpanAttributes();if(!f)return;if(f.get("next.span_type")!==o.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${f.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let g=f.get("next.route");if(g){let a=`${c} ${g}`;e.setAttributes({"next.route":g,"http.route":g,"next.span_name":a}),e.updateName(a)}else e.updateName(`${c} ${a.url}`)});e?await j(e):await d.withPropagatedContext(a.headers,()=>d.trace(o.BaseServerSpan.handleRequest,{spanName:`${c} ${a.url}`,kind:n.SpanKind.SERVER,attributes:{"http.method":c,"http.target":a.url}},j))}catch(a){if(r.isDev)throw a;(0,e.sendError)(b,500,"Internal Server Error")}finally{null==c.waitUntil||c.waitUntil.call(c,Promise.resolve())}}}};var b=require("../../webpack-api-runtime.js");b.C(a);var c=b.X(0,[169],()=>b(b.s=5801));module.exports=c})();