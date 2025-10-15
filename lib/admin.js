
export function getAdminEndpoint(){
  const domain=process.env.SHOPIFY_SHOP||process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN||process.env.NEXT_PUBLIC_SHOP_DOMAIN;
  return `https://${domain}/admin/api/2024-07/graphql.json`;
}
export function getAdminHeaders(){
  const token=process.env.SHOPIFY_ADMIN_ACCESS_TOKEN||process.env.SHOPIFY_ADMIN_TOKEN;
  if(!token) throw new Error("missing-admin-token");
  return {"Content-Type":"application/json","X-Shopify-Access-Token":token};
}
export async function adminGraphQL(query, variables){
  const r=await fetch(getAdminEndpoint(),{method:"POST",headers:getAdminHeaders(),body:JSON.stringify({query,variables})});
  const j=await r.json(); if(j.errors?.length) throw new Error(j.errors[0].message||"admin-graphql-error"); return j.data;
}
