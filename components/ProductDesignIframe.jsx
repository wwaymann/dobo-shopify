export default function ProductDesignIframe({ designJsonUrl, designPreviewUrl, designId, shopDomain, height = 640 }) {
  const base = '/'; // el customizador vive en /pages/index.js
  const params = new URLSearchParams();
  if (designJsonUrl)   params.set('designUrl', designJsonUrl);
  if (designPreviewUrl)params.set('previewUrl', designPreviewUrl);
  if (designId)        params.set('designId', designId);
  if (shopDomain)      params.set('shopDomain', shopDomain);
  const sep = base.includes('?') ? '&' : '?';
  const src = `${base}${params.toString() ? sep + params.toString() : ''}`;

  return (
    <div className="ratio ratio-16x9" style={{ minHeight: height }}>
      <iframe src={src} title="DOBO Customizer" style={{ width:'100%',height:'100%',border:0 }} allow="clipboard-write; fullscreen" />
    </div>
  );
}
