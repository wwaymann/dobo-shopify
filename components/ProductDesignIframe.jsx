// components/ProductDesignIframe.jsx
export default function ProductDesignIframe({ designJsonUrl, designPreviewUrl, designId, height = 640 }) {
  const src = designJsonUrl
    ? `/app/embed?designUrl=${encodeURIComponent(designJsonUrl)}&preview=${encodeURIComponent(designPreviewUrl || '')}&designId=${encodeURIComponent(designId || '')}`
    : `/app/embed`;

  return (
    <div className="ratio ratio-16x9" style={{ minHeight: height }}>
      <iframe
        src={src}
        title="DOBO Customizer"
        style={{ width: '100%', height: '100%', border: 0 }}
        allow="clipboard-write; fullscreen"
      />
    </div>
  );
}
