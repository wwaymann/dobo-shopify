import { Component } from "react";

export default class GlobalErrorBoundary extends Component {
  constructor(p){ super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err){ return { err }; }
  componentDidCatch(error, info){
    // Log a consola SIEMPRE
    console.error("[DOBO] Uncaught UI error:", error, info);
    // Opcional: hit a tu endpoint
    // navigator.sendBeacon?.("/api/log", new Blob([JSON.stringify({error:String(error), info})], {type:"application/json"}));
  }
  render(){
    if (!this.state.err) return this.props.children;
    // UI mínima para prod (no rompe todo)
    return (
      <div style={{padding:24,fontFamily:"system-ui"}}>
        <h3>Se produjo un problema al cargar la página</h3>
        <p style={{opacity:.7}}>Abre la consola del navegador para ver el detalle exacto del error.</p>
      </div>
    );
  }
}
