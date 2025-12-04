import "../styles/home.module.css";
import GlobalErrorBoundary from "../components/GlobalErrorBoundary";
import "../styles/customizer.css";

function App({ Component, pageProps }) {
  if (typeof window !== "undefined") {
    if (!window.__DOBO_ERR_LISTENERS__) {
      window.__DOBO_ERR_LISTENERS__ = true;

      window.addEventListener("error", (e) => {
        console.error("[DOBO] window.onerror:", e?.error || e?.message || e);
      });

      window.addEventListener("unhandledrejection", (e) =>
        console.error("[DOBO] unhandledrejection:", e?.reason || e)
      );
    }
  }

  return (
    <GlobalErrorBoundary>
      <Component {...pageProps} />
    </GlobalErrorBoundary>
  );
}

export default App;
