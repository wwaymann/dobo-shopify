// pages/api/publish-by-variant.js

// Aumenta límite del body para dataURL del preview
export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

const ADMIN_API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION || '2024-10';

function pickEnv() {
  const token = process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ADMIN_API_TOKEN;
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
    const e = new Error('env-missing');
    e.stage = 'env';
    throw e;
  }

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.errors) {
    const e = new Error('shopify-graphql-error');
    e.stage = 'graphql';
    e.details = j.errors || j;
    throw e;
  }
  return j.data;
}

// ---------------- GraphQL ----------------

const GQL_STAGED_UPLOADS_CREATE = `
mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) {
    stagedTargets {
      url
      resourceUrl
      parameters { name value }
    }
    userErrors { field message }
  }
}
`;

const GQL_FILE_CREATE = `
mutation fileCreate($files: [FileCreateInput!]!) {
  fileCreate(files: $files) {
    files {
      __typename
      id
      alt
      createdAt
      ... on MediaImage { image { url } }
      ... on GenericFile { url }
    }
    userErrors { field message }
  }
}
`;

const GQL_VARIANT_PARENT = `
query($id: ID!) {
  productVariant(id: $id) {
    id
    product { id handle }
  }
}
`;

const GQL_METAFIELDS_SET = `
mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id key namespace }
    userErrors { field message }
  }
}
`;

// -------------- Helpers --------------

function dataUrlToBuffer(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:([\w/+.-]+);base64,(.*)$/);
  if (!m) return null;
  const mime = m[1];
  const b64 = m[2];
  return { mime, buf: Buffer.from(b64, 'base64') };
}

async function stagedUpload({ filename, mimeType, buffer }) {
  // 1) pedir target
  const upRes = await shopifyFetch(GQL_STAGED_UPLOADS_CREATE, {
    input: [
      {
        resource: 'FILE',
        filename,
        mimeType,
        httpMethod: 'POST',
      },
    ],
  });

  const target = upRes?.stagedUploadsCreate?.stagedTargets?.[0];
  const errs = upRes?.stagedUploadsCreate?.userErrors || [];
  if (!target || errs.length) {
    const e = new Error('staged-uploads-failed');
    e.stage = 'stagedUploadsCreate';
    e.details = errs;
    throw e;
  }

  // 2) subir a GCS con form-data
  const form = new FormData();
  for (const p of target.parameters || []) form.append(p.name, p.value);
  // El nombre de campo debe ser "file"
  form.append('file', new Blob([buffer]), filename);

  const r = await fetch(target.url, { method: 'POST', body: form });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    const e = new Error('staged-upload-post-failed');
    e.stage = 'gcs-upload';
    e.details = { status: r.status, body: txt };
    throw e;
  }

  // 3) resourceUrl para fileCreate
  return target.resourceUrl;
}

async function fileCreateFromResourceUrls(inputs) {
  // inputs: [{ resourceUrl, contentType, alt }]
  const files = inputs.map((x) => ({
    originalSource: x.resourceUrl,
    contentType: x.contentType, // "IMAGE" | "FILE"
    alt: x.alt || null,
  }));

  const res = await shopifyFetch(GQL_FILE_CREATE, { files });
  const userErrors = res?.fileCreate?.userErrors || [];
  if (userErrors.length) {
    const e = new Error('fileCreate-errors');
    e.stage = 'fileCreate';
    e.details = userErrors;
    throw e;
  }
  const out = res?.fileCreate?.files || [];
  const urls = out.map((f) => {
    if (f.__typename === 'MediaImage') return f.image?.url || '';
    if (f.__typename === 'GenericFile') return f.url || '';
    return '';
  });
  return { files: out, urls };
}

async function getProductFromVariant(variantId) {
  const data = await shopifyFetch(GQL_VARIANT_PARENT, { id: variantId });
  const pv = data?.productVariant;
  if (!pv?.product?.id) {
    const e = new Error('variant-parent-not-found');
    e.stage = 'variantLookup';
    e.details = { variantId };
    throw e;
  }
  return { productId: pv.product.id, handle: pv.product.handle || '' };
}

async function setProductMetafields(productId, previewUrl, jsonUrl) {
  const entries = [];
  if (previewUrl) {
    entries.push({
      ownerId: productId,
      namespace: 'dobo',
      key: 'design_preview',
      type: 'url',
      value: previewUrl,
    });
  }
  if (jsonUrl) {
    entries.push({
      ownerId: productId,
      namespace: 'dobo',
      key: 'design_json_url',
      type: 'url',
      value: jsonUrl,
    });
  }
  if (!entries.length) return;

  const res = await shopifyFetch(GQL_METAFIELDS_SET, { metafields: entries });
  const errs = res?.metafieldsSet?.userErrors || [];
  if (errs.length) {
    const e = new Error('metafieldsSet-errors');
    e.stage = 'metafieldsSet';
    e.details = errs;
    throw e;
  }
}

// -------------- Handler --------------

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'method-not-allowed' });
      return;
    }

    const { token, url } = pickEnv();
    if (!token || !url) {
      res.status(400).json({ ok: false, error: 'env-missing' });
      return;
    }

    const { variantId, previewDataURL, design, meta = {} } = req.body || {};
    if (!variantId) {
      res.status(400).json({ ok: false, error: 'missing-variantId' });
      return;
    }

    // 1) preparar buffers de archivos
    const png = dataUrlToBuffer(previewDataURL);
    if (!png || !png.buf || !/image\/png/i.test(png.mime || '')) {
      const e = new Error('invalid-preview');
      e.stage = 'decodePreview';
      throw e;
    }

    const base = typeof design === 'string' ? JSON.parse(design) : (design || {});
    const payload = { ...base, meta: { ...(base.meta || {}), ...meta } };
    const jsonBuf = Buffer.from(JSON.stringify(payload), 'utf8');

    const ts = Date.now();
    const pngName = `dobo-${ts}.png`;
    const jsonName = `dobo-${ts}.json`;

    // 2) staged uploads → resourceUrl
    const [pngResourceUrl, jsonResourceUrl] = await Promise.all([
      stagedUpload({ filename: pngName, mimeType: 'image/png', buffer: png.buf }),
      stagedUpload({ filename: jsonName, mimeType: 'application/json', buffer: jsonBuf }),
    ]);

    // 3) fileCreate → URLs públicas
    const created = await fileCreateFromResourceUrls([
      { resourceUrl: pngResourceUrl, contentType: 'IMAGE', alt: `preview-${ts}` },
      { resourceUrl: jsonResourceUrl, contentType: 'FILE', alt: `design-${ts}` },
    ]);

    const [previewUrl, jsonUrl] = created.urls;

    if (!previewUrl || !jsonUrl) {
      const e = new Error('missing file urls');
      e.stage = 'fileCreate';
      throw e;
    }

    // 4) producto padre del variant
    const { productId, handle } = await getProductFromVariant(variantId);

    // 5) guardar metafields en el PRODUCTO
    await setProductMetafields(productId, previewUrl, jsonUrl);

    res.status(200).json({
      ok: true,
      variantId,
      productId,
      handle,
      previewUrl,
      jsonUrl,
    });
  } catch (err) {
    const code = (err && err.stage === 'env') ? 400 : 500;
    res.status(code).json({
      ok: false,
      error: String(err?.message || err || 'error'),
      stage: err?.stage || null,
      details: err?.details || null,
    });
  }
}
