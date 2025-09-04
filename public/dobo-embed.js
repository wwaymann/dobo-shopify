/* /public/dobo-embed.js */
(function () {
  var SCRIPT = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  // Contenedor destino: data-target o #dobo-app
  var targetSelector = SCRIPT.getAttribute('data-target') || '#dobo-app';
  var container = document.querySelector(targetSelector);
  if (!container) {
    container = document.createElement('div');
    container.id = 'dobo-app';
    SCRIPT.parentNode.insertBefore(container, SCRIPT);
  }

  // Parámetros opcionales desde data-*
  var params = {
    productHandle: SCRIPT.getAttribute('data-product-handle') || '',
    variantId: SCRIPT.getAttribute('data-variant-id') || '',
    theme: SCRIPT.getAttribute('data-theme') || 'light',
    lang: SCRIPT.getAttribute('data-lang') || 'es',
    embed: '1'
  };

  function toQuery(obj) {
    var q = [];
    for (var k in obj) {
      if (obj[k] !== '') q.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));
    }
    return q.length ? ('?' + q.join('&')) : '';
  }

  // Origen de la app
  var appOrigin = SCRIPT.getAttribute('data-src') || 'https://dobo-shopify.vercel.app/';
  if (appOrigin[appOrigin.length - 1] !== '/') appOrigin += '/';

  // Crear iframe
  var iframe = document.createElement('iframe');
  iframe.src = appOrigin + toQuery(params);
  iframe.style.width = '100%';
  iframe.style.border = '0';
  iframe.style.display = 'block';
  iframe.style.minHeight = SCRIPT.getAttribute('data-min-height') || '700px';
  iframe.setAttribute('allow', 'clipboard-read; clipboard-write');

  // Insertar
  container.innerHTML = '';
  container.appendChild(iframe);

  // Auto-resize por postMessage
  function onMessage(e) {
    // Seguridad básica: filtra por el origen configurado
    try {
      var a = document.createElement('a');
      a.href = appOrigin;
      var sameOrigin = e.origin.indexOf(a.protocol + '//' + a.host) === 0;
      if (!sameOrigin) return;
    } catch (_) {}

    var data = e.data || {};
    if (data && data.type === 'DOBO_HEIGHT' && typeof data.px === 'number') {
      iframe.style.height = Math.max( parseInt(iframe.style.minHeight,10) || 0, data.px ) + 'px';
    }
  }
  window.addEventListener('message', onMessage, false);

  // Notificar al hijo que estamos listos
  function ping() {
    try { iframe.contentWindow && iframe.contentWindow.postMessage({ type: 'DOBO_PARENT_READY' }, '*'); } catch (_) {}
  }
  if (document.readyState === 'complete') ping(); else window.addEventListener('load', ping);
})();
