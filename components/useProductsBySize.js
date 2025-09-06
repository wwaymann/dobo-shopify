import { useEffect, useState } from "react";

export function useProductsBySize(initialSize = "Grande") {
  const [size, setSize] = useState(initialSize);
  const [products, setProducts] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetch(`/api/products?size=${encodeURIComponent(size)}`)
      .then(r => r.json())
      .then(j => { if (!cancel) { setProducts(j.products || []); setCount(j.count || 0); }})
      .catch(e => !cancel && setError(e))
      .finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [size]);

  return { size, setSize, products, count, loading, error };
}
