
import { adminGraphQL } from "../../lib/admin";

async function cloudinaryUploadIfNeeded(urlOrData){
  try{
    if(!urlOrData) return "";
    if(/^https?:\/\//i.test(urlOrData)) return urlOrData;
    if(!urlOrData.startsWith("data:")) return urlOrData;
    const cloud=process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset=process.env.NEXT_PUBLIC_CLOUDINARY_UNSIGNED_PRESET;
    if(!cloud||!preset) return urlOrData;
    const form=new FormData(); form.append("file",urlOrData); form.append("upload_preset",preset);
    const r=await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`,{method:"POST",body:form}); const j=await r.json();
    return j.secure_url||j.url||urlOrData;
  }catch{return urlOrData}
}

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try{
    const {title="DOBO",previewUrl="",price=0,color="Único",size="Único",designId=`dobo-${Date.now()}`,plantTitle="Planta",potTitle="Maceta",shortDescription}=req.body||{};
    const preview=await cloudinaryUploadIfNeeded(previewUrl);
    const description=(shortDescription||`DOBO personalizado • ${plantTitle} + ${potTitle}\nColor: ${color} • Tamaño: ${size}\nDesignId: ${designId}`).replace(/\n/g,"<br/>");
    const CREATE=`mutation ProductCreate($input: ProductInput!){productCreate(input:$input){product{id title handle variants(first:1){edges{node{id legacyResourceId}}}} userErrors{field message}}}`;
    const data=await adminGraphQL(CREATE,{input:{title,productType:"DOBO",status:"ACTIVE",tags:["dobo","custom"],options:["Color","Tamaño"],images:preview?[{src:preview,altText:title}]:[],variants:[{price:String(price),sku:designId,options:[color,size]}],descriptionHtml:description}});
    const err=data?.productCreate?.userErrors?.[0]?.message; const product=data?.productCreate?.product; if(!product) return res.status(500).json({error:err||"productCreate-failed"});
    const META=`mutation MetafieldsSet($metafields:[MetafieldsSetInput!]!){metafieldsSet(metafields:$metafields){metafields{key namespace} userErrors{field message}}}`;
    await adminGraphQL(META,{metafields:[{ownerId:product.id,namespace:"dobo",key:"designId",type:"single_line_text_field",value:String(designId)},{ownerId:product.id,namespace:"dobo",key:"components",type:"single_line_text_field",value:`${plantTitle} + ${potTitle}`},]}).catch(()=>null);
    const pubId=process.env.SHOPIFY_PUBLICATION_ID;
    if(pubId){ const PUB=`mutation Publish($id:ID!,$pub:ID!){publishablePublish(id:$id,input:{publicationId:$pub}){publishable{id} userErrors{field message}}}`; await adminGraphQL(PUB,{id:product.id,pub:pubId}).catch(()=>null); }
    const variantId=product?.variants?.edges?.[0]?.node?.id||null; return res.status(200).json({ok:true,productId:product.id,variantId,preview});
  }catch(e){ return res.status(500).json({error:String(e?.message||e)}) }
}
