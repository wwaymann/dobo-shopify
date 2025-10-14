// lib/canvasWillReadFrequently.js
(function(){
  if (typeof HTMLCanvasElement === "undefined") return;
  const _get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, opts){
    if (type === "2d") {
      const o = opts && typeof opts === "object" ? { ...opts } : {};
      if (!("willReadFrequently" in o)) o.willReadFrequently = true;
      return _get.call(this, type, o);
    }
    return _get.call(this, type, opts);
  };
})();
