// pages/api/design-product.js
import { adminGraphQL } from "../../lib/admin";
export const config = { runtime: "edge" };
async function uploadIfDataUrl(previewUrl) {
  try {
    if (!previewUrl || !/^data:image\//.test(previewUrl)) return previewUrl;
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UNSIGNED_PRESET;
    if (!cloud || !preset) return previewUrl;
    const form = new FormData();
    form.set("file", previewUrl);
    form.set("upload_preset", preset);
    const up = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
      method: "POST",
      body: form,
    });
    const j = await up.json();
    return j?.secure_url || j?.url || previewUrl;
  } catch {
    return previewUrl;
  }
}
export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method-not-allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const body = await req.json();
    const {
      title = "DOBO",
      previewUrl = "",
      price = 0,
      color = "Único",
      size = "Único",
      designId = `dobo-${Date.now()}`,
      plantTitle = "Planta",
      potTitle = "Maceta",
    } = body || {};
    const imgUrl = await uploadIfDataUrl(previewUrl);
    const productTitle = title || `DOBO ${plantTitle} + ${potTitle}`;
    const productInput = {
      title: productTitle,
      status: "ACTIVE",
      productType: "DOBO",
      tags: ["dobo", "custom"],
      options: ["Color", "Tamaño"],
      variants: [{
        title: `${color} / ${size}`,
        price: String(price || 0),
        options: [color, size],
        taxable: false,
        inventoryPolicy: "DENY",
      }],
      images: imgUrl ? [{ src: imgUrl, altText: productTitle }] : [],
      metafields: [
        { namespace: "dobo", key: "designId", type: "single_line_text_field", value: String(designId) },
        { namespace: "dobo", key: "components", type: "json", value: JSON.stringify({ plantTitle, potTitle, color, size }) },
      ],
    };
    const createMutation = `#graphql
      mutation CreateProduct($input: ProductInput!) {
        productCreate(input: $input) {
          product { id title variants(first: 1) { nodes { id } } }
          userErrors { field message }
        }
      }`;
    const data = await adminGraphQL(createMutation, { input: productInput });
    const errors = data?.productCreate?.userErrors;
    const productId = data?.productCreate?.product?.id;
    const variantId = data?.productCreate?.product?.variants?.nodes?.[0]?.id;
    if (errors?.length || !productId || !variantId) {
      return new Response(JSON.stringify({ ok: false, error: errors?.[0]?.message || "product-create-failed" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }
    const pubId = process.env.SHOPIFY_PUBLICATION_ID;
    if (pubId) {
      const publishMutation = `#graphql
        mutation Publish($id: ID!, $pub: ID!) {
          publishablePublish(id: $id, input: { publicationId: $pub }) {
            userErrors { field message }
          }
        }`;
      try { await adminGraphQL(publishMutation, { id: productId, pub: pubId }); } catch {}
    }
    return new Response(JSON.stringify({ ok: true, productId, variantId }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
