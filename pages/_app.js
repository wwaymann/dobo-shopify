import "../styles/home.module.css"; // tus estilos globales si aplica
import GlobalErrorBoundary from "../components/GlobalErrorBoundary";
import '../styles/customizer.css';  // <-- agrega esta línea aquí

function App({ Component, pageProps }) {
  // Listeners globales (solo en cliente)
  if (typeof window !== "undefined") {
    // Evita añadirlos múltiples veces
    if (!window.__DOBO_ERR_LISTENERS__) {
      window.__DOBO_ERR_LISTENERS__ = true;

      window.addEventListener("error", (e) => {
        console.error("[DOBO] window.onerror:", e?.error || e?.message || e);
      });

      window.addEventListener("unhandledrejection", (e) => {
        console.error("[DOBO] unhandledrejection:", e?.reason || e);
      });
    }
  }

  return (
    <GlobalErrorBoundary>
      <Component {...pageProps} />
    </GlobalErrorBoundary>
  );
}

export default App;

