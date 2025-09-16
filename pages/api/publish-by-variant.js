// pages/api/publish-by-variant.js
export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

const ADMIN_API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION || '2024-10';

function pickEnv() {
  const token =
    process.env.SHOPIFY_ADMIN_TOKEN ||
    process.env.SHOPIFY_ADMIN_API_TOKEN;
  const shop =
    process.env.SHOPIFY_SHOP_DOMAIN ||
    process.env.SHOPIFY_SHOP ||
    process.env.SHOP_DOMAIN ||
    '';
  const url =
    process.env.SHOPIFY_ADMIN_API_URL ||
    (shop ? `https://${shop}/admin/api/${ADMIN_API_VERSION}/graphql.json` : '');
  return { token, url, shop };
}

async function shopifyFetch(query, variables) {
  const { token, url } = pickEnv();
  if (!token || !url) {
    const e = new Error('env-missing'); e.stage = 'env'; throw e;
  }
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.errors) {
    const e = new Error('shopify-graphql-error');
    e.stage = 'graphql'; e.details = j.errors || j; throw e;
  }
  return j.data;
}

/* GQL */
const GQL_STAGED_UPLOADS_CREATE = `
mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) {
    stagedTargets { url resourceUrl parameters { name value } }
    userErrors { field message }
  }
}`;
const GQL_FILE_CREATE = `
mutation fileCreate($files: [FileCreateInput!]!) {
  fileCreate(files: $files) {
    files {
      __typename id alt createdAt
      ... on MediaImage { image { url } }
      ... on GenericFile { url }
    }
    userErrors { field message }
  }
}`;
const GQL_VARIANT_PARENT = `
query($id: ID!) {
  productVariant(id: $id) { id product { id handle } }
}`;
const GQL_METAFIELDS_SET = `
mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id key namespace }
    userErrors { field message }
  }
}`;

const GQL_FILES_BY_ID = `
query filesById($ids: [ID!]!) {
  nodes(ids: $ids) {
    id
    __typename
    ... on MediaImage { image { url } }
    ... on GenericFile { url }
  }
}`;


/* Helpers */
function dataUrlToBuffer(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:([\w/+.-]+);base64,(.*)$/);
  if (!m) return null;
  return { mime: m[1], buf: Buffer.from(m[2], 'base64') };
}

async function stagedUpload({ filename, mimeType, buffer, resource }) {
  // resource: 'IMAGE' | 'FILE'
  const up = await shopifyFetch(GQL_STAGED_UPLOADS_CREATE, {
    input: [{ resource, filename, mimeType, httpMethod: 'POST' }],
  });
  const target = up?.stagedUploadsCreate?.stagedTargets?.[0];
  const errs = up?.stagedUploadsCreate?.userErrors || [];
  if (!target || errs.length) {
    const e = new Error('staged-uploads-failed');
    e.stage = 'stagedUploadsCreate'; e.details = errs; throw e;
  }
  const form = new FormData();
  for (const p of target.parameters || []) form.append(p.name, p.value);
  form.append('file', new Blob([buffer]), filename);
  const r = await fetch(target.url, { method:'POST', body: form });
  if (!r.ok) {
    const txt = await r.text().catch(()=>'');
    const e = new Error('gcs-upload-failed');
    e.stage = 'gcs-upload'; e.details = { status:r.status, body:txt }; throw e;
  }
  return target.resourceUrl;
}

async function fileCreateFromResourceUrls(inputs) {
  // inputs: [{ resourceUrl, contentType:'IMAGE'|'FILE', alt? }]
  const filesInput = inputs.map(x => ({
    originalSource: x.resourceUrl,
    contentType: x.contentType,
    alt: x.alt || null,
  }));

  const res = await shopifyFetch(GQL_FILE_CREATE, { files: filesInput });
  const uerr = res?.fileCreate?.userErrors || [];
  if (uerr.length) {
    const e = new Error('fileCreate-errors');
    e.stage = 'fileCreate'; e.details = uerr; throw e;
  }
  const created = res?.fileCreate?.files || [];
  const ids = created.map(f => f.id).filter(Boolean);

  // intento inmediato
  let urls = created.map(f =>
    f.__typename === 'MediaImage' ? (f.image?.url || '') :
    f.__typename === 'GenericFile' ? (f.url || '') : ''
  );

  const haveAll = () => urls.every(u => typeof u === 'string' && u.length > 0);

  // si faltan, poll a nodes(ids) hasta 8 veces
  for (let i = 0; i < 8 && !haveAll(); i++) {
    await new Promise(r => setTimeout(r, 400 + i * 150));
    const nodes = await shopifyFetch(GQL_FILES_BY_ID, { ids });
    const byId = new Map(
      (nodes?.nodes || []).map(n => {
        const url = n?.__typename === 'MediaImage' ? (n?.image?.url || '') :
                    n?.__typename === 'GenericFile' ? (n?.url || '') : '';
        return [n?.id, url];
      })
    );
    urls = created.map(f => byId.get(f.id) || '');
  }

  if (!haveAll()) {
    const e = new Error('missing file urls');
    e.stage = 'fileCreate';
    e.details = { ids, urls };
    throw e;
  }

  return { files: created, urls };
}


async function getProductFromVariant(variantId) {
  const d = await shopifyFetch(GQL_VARIANT_PARENT, { id: variantId });
  const pv = d?.productVariant;
  if (!pv?.product?.id) {
    const e = new Error('variant-parent-not-found');
    e.stage = 'variantLookup'; e.details = { variantId }; throw e;
  }
  return { productId: pv.product.id, handle: pv.product.handle || '' };
}

async function setProductMetafields(productId, previewUrl, jsonUrl) {
  const metafields = [];
  if (previewUrl) metafields.push({
    ownerId: productId, namespace:'dobo', key:'design_preview', type:'url', value: previewUrl
  });
  if (jsonUrl) metafields.push({
    ownerId: productId, namespace:'dobo', key:'design_json_url', type:'url', value: jsonUrl
  });
  if (!metafields.length) return;
  const r = await shopifyFetch(GQL_METAFIELDS_SET, { metafields });
  const errs = r?.metafieldsSet?.userErrors || [];
  if (errs.length) {
    const e = new Error('metafieldsSet-errors');
    e.stage = 'metafieldsSet'; e.details = errs; throw e;
  }
}

/* Handler */
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method-not-allowed' });

    const { token, url } = pickEnv();
    if (!token || !url) return res.status(400).json({ ok:false, error:'env-missing' });

    const { variantId, previewDataURL, design, meta = {} } = req.body || {};
    if (!variantId) return res.status(400).json({ ok:false, error:'missing-variantId' });

    // preview PNG
    const png = dataUrlToBuffer(previewDataURL);
    if (!png?.buf || !/image\/png/i.test(png.mime||'')) {
      const e = new Error('invalid-preview'); e.stage = 'decodePreview'; throw e;
    }

    // JSON con meta fusionada
    const base = typeof design === 'string' ? JSON.parse(design) : (design || {});
    const payload = { ...base, meta: { ...(base.meta || {}), ...meta } };
    const jsonBuf = Buffer.from(JSON.stringify(payload), 'utf8');

    const ts = Date.now();
    const pngName = `dobo-${ts}.png`;
    const jsonName = `dobo-${ts}.json`;

    // staged uploads: OJO tipo correcto
    const [pngResourceUrl, jsonResourceUrl] = await Promise.all([
      stagedUpload({ filename: pngName,  mimeType: 'image/png',         buffer: png.buf,  resource: 'IMAGE' }),
      stagedUpload({ filename: jsonName, mimeType: 'application/json',  buffer: jsonBuf, resource: 'FILE'  }),
    ]);

    // crear Files públicos
    const created = await fileCreateFromResourceUrls([
      { resourceUrl: pngResourceUrl,  contentType: 'IMAGE', alt: `preview-${ts}` },
      { resourceUrl: jsonResourceUrl, contentType: 'FILE',  alt: `design-${ts}`  },
    ]);

    const [previewUrl, jsonUrl] = created.urls;
    if (!previewUrl || !jsonUrl) {
      const e = new Error('missing file urls'); e.stage = 'fileCreate'; e.details = created; throw e;
    }

    // producto padre
    const { productId, handle } = await getProductFromVariant(variantId);

    // metafields en PRODUCTO
    await setProductMetafields(productId, previewUrl, jsonUrl);

    res.status(200).json({ ok:true, variantId, productId, handle, previewUrl, jsonUrl });
  } catch (err) {
    const code = err?.stage === 'env' ? 400 : 500;
    res.status(code).json({
      ok:false,
      error:String(err?.message||err||'error'),
      stage:err?.stage||null,
      details:err?.details||null,
    });
  }
}
