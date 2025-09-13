import { adminGraphQL } from './shopifyAdmin';

async function stagedUploadsCreate(items) {
  const input = items.map(it => ({
    resource: "FILE",
    filename: it.filename,
    mimeType: it.mimeType,
    httpMethod: "POST"
  }));
  const data = await adminGraphQL(`
    mutation($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }
  `, { input });
  const { stagedTargets, userErrors } = data.stagedUploadsCreate;
  if (userErrors?.length) throw new Error(JSON.stringify(userErrors));
  return stagedTargets;
}

async function finalizeFiles(sources) {
  const data = await adminGraphQL(`
    mutation($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files { id url }
        userErrors { field message }
      }
    }
  `, { files: sources });
  const { files, userErrors } = data.fileCreate;
  if (userErrors?.length) throw new Error(JSON.stringify(userErrors));
  return files;
}

export async function uploadDesignToShopifyFiles({ previewBuffer, jsonString, designId }) {
  const id = designId ?? `dobo-${Date.now()}`;
  const targets = await stagedUploadsCreate([
    { filename: `${id}.png`, mimeType: 'image/png' },
    { filename: `${id}.json`, mimeType: 'application/json' }
  ]);

  async function postToS3(target, file) {
    const form = new FormData();
    target.parameters.forEach(p => form.append(p.name, p.value));
    form.append('file', file);
    const resp = await fetch(target.url, { method: 'POST', body: form });
    if (!resp.ok) throw new Error(`S3 upload failed ${resp.status}`);
  }

  await postToS3(targets[0], new Blob([previewBuffer], { type: 'image/png' }));
  await postToS3(targets[1], new Blob([Buffer.from(jsonString)], { type: 'application/json' }));

  const files = await finalizeFiles([
    { resourceUrl: targets[0].resourceUrl, contentType: 'IMAGE', alt: id },
    { resourceUrl: targets[1].resourceUrl, contentType: 'FILE' }
  ]);

  const previewUrl = files.find(f => f.url.endsWith('.png'))?.url ?? files[0].url;
  const jsonUrl = files.find(f => f.url.endsWith('.json'))?.url ?? files[1].url;
  return { id, previewUrl, jsonUrl };
}
