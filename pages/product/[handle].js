import ProductDesignIframe from '../../components/ProductDesignIframe'

// tras obtener `product`:
const designJsonUrl = product?.metafield?.value ?? product?.metafields?.designJsonUrl?.value;
const previewUrl    = product?.metafield_designPreviewUrl?.value ?? product?.metafields?.designPreviewUrl?.value;
const designId      = product?.metafield_designId?.value ?? product?.metafields?.designId?.value;

<ProductDesignIframe
  designJsonUrl={designJsonUrl}
  designPreviewUrl={previewUrl}
  designId={designId}
/>
