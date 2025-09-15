export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") { res.status(405).end(); return; }
    const { variantId, previewDataURL, design, meta } = req.body || {};
    if (!variantId || !previewDataURL || !design) {
      res.status(400).json({ error: "variantId, previewDataURL y design requeridos" }); return;
    }

    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const token  = process.env.SHOPIFY_ADMIN_API_TOKEN;
    if (!domain || !token) { res.status(500).json({ error: "Faltan env SHOPIFY_*" }); return; }

    const adminGraphQL = async (query, variables) => {
      const r = await fetch(`https://${domain}/admin/api/2024-07/graphql.json`, {
        method: "POST",
        headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables })
      });
      const j = await r.json();
      if (!r.ok || j.errors) throw new Error(JSON.stringify(j.errors || r.statusText));
      return j.data;
    };

    const toGid = (v) => String(v).startsWith("gid://") ? String(v) : `gid://shopify/ProductVariant/${v}`;
    const vGid = toGid(variantId);

    // dueño del variant
    const d1 = await adminGraphQL(`query($id:ID!){ productVariant(id:$id){ product{ id handle } } }`, { id: vGid });
    const ownerId = d1?.productVariant?.product?.id;
    if (!ownerId) { res.status(404).json({ error: "Producto no encontrado" }); return; }

    // subir PNG + JSON a Files
    const b64 = String(previewDataURL).split(",")[1] || "";
    const previewBuf = Buffer.from(b64, "base64");
    const designId = `dobo-${Date.now()}`;
    const jsonString = JSON.stringify({ design, meta }, null, 0);

    const staged = await adminGraphQL(
      `mutation($input:[StagedUploadInput!]!){
        stagedUploadsCreate(input:$input){
          stagedTargets{ url resourceUrl parameters{ name value } }
          userErrors{ field message }
        }
      }`,
      { input: [
        { resource:"FILE", filename:`${designId}.png`,  mimeType:"image/png",        httpMethod:"POST" },
        { resource:"FILE", filename:`${designId}.json`, mimeType:"application/json", httpMethod:"POST" }
      ] }
    );
    const [imgT, jsonT] = staged.stagedUploadsCreate.stagedTargets;

    const postToS3 = async (t, buf, type) => {
      const form = new FormData();
      t.parameters.forEach(p => form.append(p.name, p.value));
      form.append("file", new Blob([buf], { type }));
      const r = await fetch(t.url, { method:"POST", body: form });
      if (!r.ok) throw new Error(`S3 ${r.status}`);
    };
    await postToS3(imgT, previewBuf, "image/png");
    await postToS3(jsonT, Buffer.from(jsonString), "application/json");

    const fin = await adminGraphQL(
      `mutation($files:[FileCreateInput!]!){
        fileCreate(files:$files){ files{ url } userErrors{ field message } }
      }`,
      { files:[
        { resourceUrl: imgT.resourceUrl,  contentType:"IMAGE", alt: designId },
        { resourceUrl: jsonT.resourceUrl, contentType:"FILE" }
      ] }
    );
    const files = fin.fileCreate.files || [];
    const previewUrl = files.find(f => f.url.endsWith(".png"))?.url || files[0]?.url;
    const jsonUrl    = files.find(f => f.url.endsWith(".json"))?.url || files[1]?.url;

    // metacampos del producto
    const setRes = await adminGraphQL(
      `mutation set($m:[MetafieldsSetInput!]!){
        metafieldsSet(metafields:$m){
          metafields { id key namespace }
          userErrors{ field message code }
        }
      }`,
      { m: [
        { ownerId, namespace:"dobo", key:"design_json_url",    type:"url",                    value:String(jsonUrl) },
        { ownerId, namespace:"dobo", key:"design_preview_url", type:"url",                    value:String(previewUrl) },
        { ownerId, namespace:"dobo", key:"design_id",          type:"single_line_text_field", value:String(designId) }
      ] }
    );
    const errs = setRes?.metafieldsSet?.userErrors || [];
    if (errs.length) throw new Error(`metafieldsSet ${JSON.stringify(errs)}`);

    // confirmación
    const readBack = await adminGraphQL(
      `query($id:ID!){
        product(id:$id){
          id handle
          mf1: metafield(namespace:"dobo",key:"design_json_url"){ value }
          mf2: metafield(namespace:"dobo",key:"design_preview_url"){ value }
          mf3: metafield(namespace:"dobo",key:"design_id"){ value }
        }
      }`,
      { id: ownerId }
    );

    res.status(200).json({ ok:true, productId: ownerId, previewUrl, jsonUrl, designId, readBack: readBack?.product });
  } catch (e) {
    res.status(500).json({ error: e?.message || "error" });
  }
}
