// components/ProductCard.js
export default function ProductCard({ product }) {
  const imageUrl = product.images?.edges[0]?.node?.url;
  const altText = product.images?.edges[0]?.node?.altText || product.title;
  const price = product.variants?.edges[0]?.node?.price?.amount;
  const currency = product.variants?.edges[0]?.node?.price?.currencyCode;

  return (
    <div style={{ border: '1px solid #ccc', padding: 10, margin: 10, width: 200 }}>
      {imageUrl ? (
        <img src={imageUrl} alt={altText} style={{ width: '100%' }} />
      ) : (
        <div style={{ width: '100%', height: 150, backgroundColor: '#eee' }}>
          <p style={{ textAlign: 'center', paddingTop: 60 }}>Sin imagen</p>
        </div>
      )}
      <h3>{product.title}</h3>
      <p>{product.description}</p>
      <p>
        <strong>
          {currency} {price}
        </strong>
      </p>
    </div>
  );
}

