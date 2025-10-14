// lib/canvasWillReadFrequently.js
if (typeof window === "undefined" || !window.HTMLCanvasElement) return;
const orig = HTMLCanvasElement.prototype.getContext;
if (orig && !orig.__patchedWillReadFrequently) {
  HTMLCanvasElement.prototype.getContext = function (type, opts) {
    if (type === "2d") opts = { ...(opts || {}), willReadFrequently: true };
    return orig.call(this, type, opts);
  };
  HTMLCanvasElement.prototype.getContext.__patchedWillReadFrequently = true;
}
