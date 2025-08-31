// pages/plants.js
export default function Plants({ items = [] }) {
  return (
    <main style={{ padding: 16 }}>
      <h1>Plantas</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {items.map(p => (
          <article key={p.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 8 }}>
            {p.image ? (
              <img
                src={p.image}
                alt={p.title}
                style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 6 }}
              />
            ) : null}
            <div style={{ marginTop: 8, fontSize: 14 }}>{p.title}</div>
          </article>
        ))}
        {items.length === 0 && <p>Sin resultados.</p>}
      </div>
    </main>
  );
}

export async function getServerSideProps({ req }) {
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://${req.headers.host}`;
  try {
    const r = await fetch(`${base}/api/plants`);
    const items = r.ok ? await r.json() : [];
    return { props: { items } };
  } catch {
    return { props: { items: [] } };
  }
}
