// lib/canvasWillReadFrequently.js
if (typeof window !== "undefined" && window.HTMLCanvasElement) {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, opts) {
    if (type === "2d") opts = { ...(opts || {}), willReadFrequently: true };
    return orig.call(this, type, opts);
  };
}
