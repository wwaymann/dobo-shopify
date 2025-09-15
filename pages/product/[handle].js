// pages/product/[handle].js
export default function ProductPage({ title, handle, iframeSrc }) {
  if (!iframeSrc) return (<main><h1>{title || handle}</h1><p>Sin diseño.</p></main>);
  return (
    <main>
      <h1>{title || handle}</h1>
      <iframe
        src={iframeSrc}
        style={{ width: "100%", height: "80vh", border: 0 }}
        allow="clipboard-write; clipboard-read"
      />
    </main>
  );
}

export async function getServerSideProps({ params }) {
  const handle = params.handle;
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token  = process.env.SHOPIFY_STOREFRONT_API_TOKEN;

  const query = `
    query ProductByHandle($handle: String!) {
      product(handle: $handle) {
        title
        handle
        designJsonUrl: metafield(namespace:"dobo", key:"design_json_url"){ value }
        designPreviewUrl: metafield(namespace:"dobo", key:"design_preview_url"){ value }
        designId: metafield(namespace:"dobo", key:"design_id"){ value }
      }
    }
  `;

  let title = handle, designJsonUrl = null;

  try {
    const r = await fetch(`https://${domain}/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token
      },
      body: JSON.stringify({ query, variables: { handle } })
    });
    const j = await r.json();
    const p = j?.data?.product || null;
    title = p?.title || handle;
    designJsonUrl = p?.designJsonUrl?.value || null;
  } catch (_) {}

  // Dónde vive tu customizador (la home). Cambia si usas otra ruta.
  const base = process.env.NEXT_PUBLIC_CUSTOMIZER_PATH || "/";

  const iframeSrc = designJsonUrl
    ? `${base}?designUrl=${encodeURIComponent(designJsonUrl)}`
    : base;

  return { props: { title, handle, iframeSrc } };
}
