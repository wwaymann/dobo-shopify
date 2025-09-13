// pages/product/[handle].js
import ProductDesignIframe from '../../components/ProductDesignIframe';

export default function ProductPage({ product }) {
  if (!product) return null;

  const designJsonUrl    = product.designJsonUrl?.value || null;
  const designPreviewUrl = product.designPreviewUrl?.value || null;
  const designId         = product.designId?.value || null;

  return (
    <div className="container py-3">
      {/* Aquí tu UI existente del producto */}
      <ProductDesignIframe
        designJsonUrl={designJsonUrl}
        designPreviewUrl={designPreviewUrl}
        designId={designId}
      />
    </div>
  );
}

export async function getServerSideProps({ params }) {
  const handle = params?.handle;
  if (!handle) return { notFound: true };

  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token  = process.env.SHOPIFY_STOREFRONT_API_TOKEN;
  if (!domain || !token) return { notFound: true };

  const query = `
    query ProductByHandle($handle: String!) {
      product(handle: $handle) {
        id
        title
        handle
        designJsonUrl: metafield(namespace:"dobo", key:"designJsonUrl"){ value }
        designPreviewUrl: metafield(namespace:"dobo", key:"designPreviewUrl"){ value }
        designId: metafield(namespace:"dobo", key:"designId"){ value }
      }
    }
  `;

  const r = await fetch(`https://${domain}/api/2024-07/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token
    },
    body: JSON.stringify({ query, variables: { handle } })
  });

  if (!r.ok) return { notFound: true };
  const j = await r.json();
  const product = j?.data?.product || null;

  return { props: { product } };
}
