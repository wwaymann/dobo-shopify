// pages/api/publish-by-variant.js
export const config = { runtime: 'nodejs', api: { bodyParser: { sizeLimit: '10mb' } } };

async function adminGraphQL(query, variables) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token  = process.env.SHOPIFY_ADMIN_API_TOKEN;
  const r = await fetch(`https://${domain}/admin/api/2024-07/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const j = await r.json();
  if (!r.ok || j.errors) throw new Error(JSON.stringify(j.errors || r.statusText));
  return j.data;
}
const toGid = v => String(v).startsWith('gid://') ? String(v) : `gid://shopify/ProductVariant/${v}`;

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') { res.status(405).end(); return; }
    const { variantId, previewDataURL, design, meta } = req.body || {};
    if (!variantId || !previewDataURL || !design) { res.status(400).json({ ok:false, error:'variantId, previewDataURL y design son requeridos' }); return; }
    if (!process.env.SHOPIFY_STORE_DOMAIN || !process.env.SHOPIFY_ADMIN_API_TOKEN) { res.status(500).json({ ok:false, error:'Faltan env SHOPIFY_*' }); return; }

    // 0) producto dueño
    let stage = 'owner';
    let ownerId;
    try {
      const d1 = await adminGraphQL(
        `query($id:ID!){ productVariant(id:$id){ product{ id handle } } }`,
        { id: toGid(variantId) }
      );
      ownerId = d1?.productVariant?.product?.id;
      if (!ownerId) throw new Error('product not found for variant');
    } catch (e) { return res.status(500).json({ ok:false, stage, error:String(e) }); }

    // 1) buffers
    const b64 = String(previewDataURL).split(',')[1] || '';
    const previewBuf = Buffer.from(b64, 'base64');
    const designId = `dobo-${Date.now()}`;
    const jsonString = JSON.stringify({ design, meta }, null, 0);

    // 2) stagedUploadsCreate
    stage = 'stagedUploadsCreate';
    let imgT, jsonT;
    try {
      const staged = await adminGraphQL(
        `mutation($input:[StagedUploadInput!]!){
          stagedUploadsCreate(input:$input){
            stagedTargets{ url resourceUrl parameters{ name value } }
            userErrors{ field message }
          }
        }`,
        { input: [
          { resource:'FILE', filename:`${designId}.png`,  mimeType:'image/png',        httpMethod:'POST' },
          { resource:'FILE', filename:`${designId}.json`, mimeType:'application/json', httpMethod:'POST' }
        ] }
      );
      const ue = staged?.stagedUploadsCreate?.userErrors || [];
      if (ue.length) throw new Error(JSON.stringify(ue));
      [imgT, jsonT] = staged.stagedUploadsCreate.stagedTargets;
    } catch (e) { return res.status(500).json({ ok:false, stage, error:String(e) }); }

    // 3) subir a S3
    stage = 's3-upload';
    try {
      const postToS3 = async (t, buf, type) => {
        const form = new FormData();
        t.parameters.forEach(p => form.append(p.name, p.value));
        form.append('file', new Blob([buf], { type }));
        const r = await fetch(t.url, { method:'POST', body: form });
        if (!r.ok) throw new Error(`S3 ${r.status}`);
      };
      await postToS3(imgT, previewBuf, 'image/jpeg'); // si envías JPEG desde el cliente
      await postToS3(jsonT, new TextEncoder().encode(jsonString), 'application/json');
    } catch (e) { return res.status(500).json({ ok:false, stage, error:String(e) }); }

    // 4) fileCreate con fragments
    stage = 'fileCreate';
    let previewUrl, jsonUrl;
    try {
      const fin = await adminGraphQL(
        `mutation($files:[FileCreateInput!]!){
          fileCreate(files:$files){
            files{
              __typename
              ... on MediaImage { id image { url } }
              ... on GenericFile { id url }
            }
            userErrors{ field message code }
          }
        }`,
        { files: [
          { resourceUrl: imgT.resourceUrl,  contentType:'IMAGE', alt: designId },
          { resourceUrl: jsonT.resourceUrl, contentType:'FILE'  }
        ] }
      );
      const ue = fin?.fileCreate?.userErrors || [];
      if (ue.length) throw new Error(JSON.stringify(ue));
      const files = fin?.fileCreate?.files || [];
      const media   = files.find(f => f.__typename === 'MediaImage' && f.image?.url);
      const generic = files.find(f => f.__typename === 'GenericFile' && f.url);
      previewUrl = media?.image?.url || null;
      jsonUrl    = generic?.url || null;
      if (!previewUrl || !jsonUrl) throw new Error('missing file urls');
    } catch (e) { return res.status(500).json({ ok:false, stage, error:String(e) }); }

    // 5) escribir metacampos
    stage = 'metafieldsSet';
    try {
      const setRes = await adminGraphQL(
        `mutation set($m:[MetafieldsSetInput!]!){
          metafieldsSet(metafields:$m){
            metafields { id key namespace }
            userErrors{ field message code }
          }
        }`,
        { m: [
          { ownerId, namespace:'dobo', key:'design_json_url',    type:'url',                    value:String(jsonUrl) },
          { ownerId, namespace:'dobo', key:'design_preview_url', type:'url',                    value:String(previewUrl) },
          { ownerId, namespace:'dobo', key:'design_id',          type:'single_line_text_field', value:String(designId) }
        ] }
      );
      const ue = setRes?.metafieldsSet?.userErrors || [];
      if (ue.length) throw new Error(JSON.stringify(ue));
    } catch (e) { return res.status(500).json({ ok:false, stage, error:String(e) }); }

    // 6) confirmación
    stage = 'readBack';
    try {
      const rb = await adminGraphQL(
        `query($id:ID!){
          product(id:$id){
            id handle
            mf1: metafield(namespace:"dobo", key:"design_json_url"){ value }
            mf2: metafield(namespace:"dobo", key:"design_preview_url"){ value }
            mf3: metafield(namespace:"dobo", key:"design_id"){ value }
          }
        }`,
        { id: ownerId }
      );
      return res.status(200).json({ ok:true, productId: ownerId, previewUrl, jsonUrl, designId, readBack: rb?.product });
    } catch (e) { return res.status(500).json({ ok:false, stage, error:String(e) }); }

  } catch (e) {
    return res.status(500).json({ ok:false, stage:'unknown', error:String(e?.message||e) });
  }
}
