export default function ProductDesignIframe({ designJsonUrl, designPreviewUrl, designId, height = 640 }) {
  const base = '/'; // tu customizador real vive en pages/index.js
  const has = Boolean(designJsonUrl);
  const sep = base.includes('?') ? '&' : '?';
  const qs  = has
    ? `${sep}designUrl=${encodeURIComponent(designJsonUrl)}&preview=${encodeURIComponent(designPreviewUrl || '')}&designId=${encodeURIComponent(designId || '')}`
    : '';
  const src = `${base}${qs}`;

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
