import { useEffect, useState } from 'react';
import { getProducts } from '../lib/shopify';

export default function Home() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    getProducts().then(setProducts);
  }, []);

  return (
    <div>
      <h1>DOBO Shop</h1>
      <p>Planta una idea</p>

      <div className="scroll-container">
        {products.map((product) => (
          <div key={product.id}>
            {product.images?.edges[0]?.node?.src && (
              <img src={product.images.edges[0].node.src} alt={product.title} width="100" />
            )}
            <p>{product.title}</p>
          </div>
        ))}
      </div>

      <div className="product-preview">
        {products[0]?.images?.edges[0]?.node?.src && (
          <img src={products[0].images.edges[0].node.src} alt="Preview" />
        )}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '24px',
          color: '#000'
        }}>DOBO</div>
      </div>

      <div>
        <label>Texto personalizado</label>
        <input type="text" defaultValue="DOBO" />
      </div>

      <div>
        <label>Cantidad</label>
        <select>
          <option>1</option>
          <option>2</option>
          <option>3</option>
        </select>
      </div>

      <button>Comprar</button>

      <h2>Reference image</h2>
      <div className="scroll-container">
        <div className="placeholder" />
        <div className="placeholder" />
        <div className="placeholder" />
      </div>
    </div>
  );
}