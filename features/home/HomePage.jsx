// HomePage.jsx
import React, { useRef, useEffect } from "react";

/**
 * Este componente centraliza:
 * - buyNow / addToCart (envían correo y crean el DOBO)
 * - Cálculo de capas: Overlay:All, Layer:Image, Layer:Text
 * - Composición integrada (maceta + planta + overlay)
 * - Exposición global de handlers: window.buyNow / window.addToCart
 *
 * Supone que en el entorno existen (como en tu proyecto):
 * - window.doboDesignAPI.getCanvas()  (fabric.Canvas)
 * - waitDesignerReady(ms)
 * - sendEmailNow({...})
 * - publishDesignForVariant(variantId)
 * - /api/design-product (POST)
 * - ensureHttpsUrl(dataUrl|httpUrl, tag)  (si no existe, se hace fallback)
 *
 * Variables de estado existentes (del selector actual):
 * - selectedPotIndex, selectedPlantIndex, pots, plants
 * - selectedColor, activeSize, quantity
 * - selectedPotVariant (precio) o firstVariantPrice(...)
 * - accessories / selectedAccessoryIndices
 */

export default function HomePage() {
  const stageRef = useRef(null);

  // ========= Helpers locales (no globales; sin duplicados) =========

  const lower = (s) => String(s || "").toLowerCase();

  const readImageUrlFor = (prod) =>
    prod?.featuredImage?.url ||
    prod?.image?.url ||
    prod?.image?.src ||
    (Array.isArray(prod?.images) && (prod.images[0]?.url || prod.images[0]?.src)) ||
    prod?.imageUrl ||
    "";

  const gidToNum = (id) => {
    const s = String(id || "");
    return s.includes("gid://") ? s.split("/").pop() : s;
  };

  const getAccessoryVariantIds = () =>
    (window.selectedAccessoryIndices || [])
      .map((i) => (window.accessories?.[i]?.variants?.[0]?.id))
      .map(gidToNum)
      .filter((id) => /^\d+$/.test(id));

  const putKV = (arr, k, v) => {
    if (!v) return arr;
    const lk = lower(k);
    return [
      ...arr.filter((a) => {
        const kk = lower(a.key);
        return kk !== lk && kk !== `_${lk}`;
      }),
      { key: k, value: String(v) },
    ];
  };

  const putAllAliases = (arr, baseKey, value) => {
    if (!value) return arr;
    const noColon = baseKey.replace(/:/g, "");
    return [baseKey, noColon, `_${noColon}`].reduce((ac, k) => putKV(ac, k, value), arr);
  };

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const dataLen = (s) => (s || "").length;
  const tooSmall = (d) => dataLen(d) < 2000;

  const isTextLike  = (o) => !!o && (/text/i.test(o.type || "") || typeof o.text === "string");
  const hasTextDeep = (o) => !!o && (isTextLike(o) || (Array.isArray(o?._objects) && o._objects.some(hasTextDeep)));

  // Heurística para identificar “base” (maceta/planta/bg)
  const isBaseLike = (o) => {
    if (!o) return false;
    const tag = lower(o.name || o.id || o.doboKind || o.role || "");
    return /(^(base|pot|maceta|plant|planta|bg|background)$)|(^|_|-)(pot|maceta|plant|planta|base|bg|background)(_|-|$)/.test(tag);
  };
  const hasBaseDeep = (o) => !!o && (isBaseLike(o) || (Array.isArray(o?._objects) && o._objects.some(hasBaseDeep)));

  // Ocultar/restore en canvas para exportar capas
  const hideBy = (canvas, pred) => {
    const hidden = [];
    const walk = (obj) => {
      if (!obj) return;
      if (pred(obj)) {
        hidden.push(obj);
        obj.__vis = obj.visible;
        obj.visible = false;
      }
      if (Array.isArray(obj._objects)) obj._objects.forEach(walk);
    };
    (canvas.getObjects?.() || []).forEach(walk);
    if (canvas.backgroundImage && pred(canvas.backgroundImage)) {
      const bg = canvas.backgroundImage;
      hidden.push(bg);
      bg.__vis = bg.visible;
      bg.visible = false;
    }
    canvas.requestRenderAll?.();
    return () => {
      hidden.forEach((o) => {
        o.visible = (o.__vis !== false);
        delete o.__vis;
      });
      canvas.requestRenderAll?.();
    };
  };

  const snap = (canvas, mult = 2) =>
    canvas.toDataURL({ format: "png", multiplier: mult, backgroundColor: null });

  // Carga robusta de imágenes externas (CORS → rehost + retry)
  const loadImageRobust = async (url) => {
    if (!url) return null;
    const tryLoad = (u) =>
      new Promise((res, rej) => {
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = u;
      });
    try {
      return await tryLoad(url);
    } catch {
      // fallback: intenta rehost (si tienes endpoint), si no, abandona
      try {
        if (typeof window.rehostForCORS === "function") {
          const prox = await window.rehostForCORS(url);
          if (prox) return await tryLoad(prox);
        } else {
          // fallback genérico a /api/image-proxy?url=...
          const r = await fetch("/api/image-proxy?url=" + encodeURIComponent(url));
          const j = await r.json().catch(() => null);
          const du = j?.dataUrl || "";
          if (/^data:image\//i.test(du)) return await tryLoad(du);
        }
      } catch {
        // nada
      }
      return null;
    }
  };

  const ensureHttps = async (u, tag) => {
    if (!u) return u;
    if (typeof window.ensureHttpsUrl === "function") {
      try { return await window.ensureHttpsUrl(u, tag); } catch { /* noop */ }
    }
    return u; // fallback: deja como está (dataURL o http)
  };

  // Composición: planta + maceta + overlay (todos del mismo tamaño)
  const composeIntegrated = async (overlayDataUrl, potUrl, plantUrl) => {
    if (!overlayDataUrl) return "";
    const overlayImg = await new Promise((res, rej) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = overlayDataUrl;
    });
    const W = overlayImg.naturalWidth || overlayImg.width || 1024;
    const H = overlayImg.naturalHeight || overlayImg.height || 1024;
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const ctx = off.getContext("2d");

    const potImg   = await loadImageRobust(potUrl);
    const plantImg = await loadImageRobust(plantUrl);
    if (potImg)   ctx.drawImage(potImg,   0, 0, W, H);
    if (plantImg) ctx.drawImage(plantImg, 0, 0, W, H);
    ctx.drawImage(overlayImg, 0, 0, W, H);
    return off.toDataURL("image/png");
  };

  // ============= Núcleo: exportar capas + integrada =============
  const exportAllImages = async () => {
    const ok = await (window.waitDesignerReady?.(20000));
    if (!ok) throw new Error("designer-not-ready");

    const canvas = window.doboDesignAPI?.getCanvas?.();
    if (!canvas) throw new Error("canvas-missing");

    await delay(50); // flush de render

    // Overlay:All (sin base)
    let restore = hideBy(canvas, (o) => hasBaseDeep(o) || o === canvas.backgroundImage);
    let overlayAll = snap(canvas, 2);
    restore();

    // Layer:Text (solo texto)
    restore = hideBy(canvas, (o) => hasBaseDeep(o) || o === canvas.backgroundImage);
    const hideNonText = hideBy(canvas, (o) => !hasTextDeep(o));
    let layerTxt = snap(canvas, 2);
    hideNonText(); restore();

    // Layer:Image (sin texto)
    restore = hideBy(canvas, (o) => hasBaseDeep(o) || o === canvas.backgroundImage);
    const hideText = hideBy(canvas, (o) => hasTextDeep(o));
    let layerImg = snap(canvas, 2);
    hideText(); restore();

    if (tooSmall(layerTxt)) layerTxt = "";
    if (tooSmall(layerImg) && !tooSmall(overlayAll)) layerImg = overlayAll;

    // URLs de planta/maceta actuales
    const potUrl   = readImageUrlFor(window.pots?.[window.selectedPotIndex]);
    const plantUrl = readImageUrlFor(window.plants?.[window.selectedPlantIndex]);

    // Integrada
    const previewFull = await composeIntegrated(overlayAll, potUrl, plantUrl);

    // Subir (si corresponde)
    const overlayAllHttps  = await ensureHttps(overlayAll, "overlay");
    const layerImgHttps    = await ensureHttps(layerImg, "layer-image");
    const layerTxtHttps    = layerTxt ? await ensureHttps(layerTxt, "layer-text") : "";
    const previewFullHttps = await ensureHttps(previewFull, "preview-full");

    return { overlayAllHttps, layerImgHttps, layerTxtHttps, previewFullHttps };
  };

  // ============= Flujo de compra y correo centralizado =============
  const runPurchase = async ({ goToCheckout }) => {
    // 1) Atributos base
    let attrs = [];
    if (typeof window.buildAndSaveDesignForCartCheckout === "function") {
      const r = await window.buildAndSaveDesignForCartCheckout();
      attrs = Array.isArray(r?.attributes) ? r.attributes : [];
    } else if (typeof window.prepareDesignAttributes === "function") {
      attrs = await window.prepareDesignAttributes();
    }

    // 2) Exportar imágenes
    const { overlayAllHttps, layerImgHttps, layerTxtHttps, previewFullHttps } = await exportAllImages();

    // 3) Mezclar attrs (sin duplicados) y escribir aliases para el backend/email
    const pushKV = (k, v) => { attrs = putKV(attrs, k, v); };
    attrs = putAllAliases(attrs, "DesignPreview",  previewFullHttps);
    attrs = putAllAliases(attrs, "Overlay:All",    overlayAllHttps);
    attrs = putAllAliases(attrs, "Layer:Image",    layerImgHttps);
    attrs = putAllAliases(attrs, "Layer:Text",     layerTxtHttps);
    attrs = putKV(attrs, "Preview:Full", previewFullHttps);

    // 4) Precio y metadata
    const potPrice   = window.selectedPotVariant?.price
      ? Number(window.selectedPotVariant.price)
      : (typeof window.firstVariantPrice === "function"
          ? window.firstVariantPrice(window.pots?.[window.selectedPotIndex])
          : 0);
    const plantPrice = typeof window.productMin === "function"
      ? window.productMin(window.plants?.[window.selectedPlantIndex])
      : Number(window.plants?.[window.selectedPlantIndex]?.minPrice || 0);

    const quantity   = Number(window.quantity || 1);
    const basePrice  = Number(((potPrice + plantPrice) * quantity).toFixed(2));

    // 5) Crear producto temporal (DOBO)
    const title =
      `DOBO ${(window.plants?.[window.selectedPlantIndex]?.title || "").trim()} + ` +
      `${(window.pots?.[window.selectedPotIndex]?.title || "").trim()}`.trim();

    const dpRes = await fetch("/api/design-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        previewUrl: previewFullHttps,  // ← integrada
        price: basePrice,
        color: window.selectedColor || "Único",
        size:  window.activeSize   || "Único",
        designId: (attrs.find(a => lower(a.key) === "designid" || lower(a.key) === "_designid")?.value) || `dobo-${Date.now()}`,
        plantTitle: window.plants?.[window.selectedPlantIndex]?.title || "Planta",
        potTitle:   window.pots?.[window.selectedPotIndex]?.title   || "Maceta",
      }),
    });

    const dp = await dpRes.json().catch(() => null);
    if (!dpRes.ok || !dp?.variantId) throw new Error(dp?.error || "No se creó el producto DOBO");

    // 6) DO/NO
    const doNum = (attrs.find(a => lower(a.key) === "designid" || lower(a.key) === "_designid")?.value || "")
      .toString().slice(-8).toUpperCase();
    const noNum = gidToNum(dp.variantId);
    attrs = putKV(attrs, "_DO", doNum);
    attrs = putKV(attrs, "_NO", noNum);
    attrs = putKV(attrs, "DO",  doNum);
    attrs = putKV(attrs, "NO",  noNum);

    // 7) Email (una sola vez, desde HomePage)
    const shortDescription = (
      `DOBO ${window.plants?.[window.selectedPlantIndex]?.title ?? ""} + ` +
      `${window.pots?.[window.selectedPotIndex]?.title ?? ""} · ` +
      `${window.activeSize ?? ""} · ${window.selectedColor ?? ""}`
    ).replace(/\s+/g, " ").trim();

    const emailAttrs = attrs.slice();
    window.__doboDebug = window.__doboDebug || {};
    window.__doboDebug.emailAttrs = emailAttrs;

    if (typeof window.sendEmailNow === "function") {
      await window.sendEmailNow({
        subject: (typeof window.makeEmailSubject === "function"
          ? window.makeEmailSubject({ doNum, noNum })
          : `Nuevo diseño DOBO ${doNum} / ${noNum}`),
        attrs: emailAttrs,
        meta: { Descripcion: shortDescription, Precio: basePrice },
        links: { Storefront: location.origin },
        attachPreviews: true,
        attachOverlayAll: true,
      });
    }

    // 8) Publicar assets en el variant (si aplica)
    if (typeof window.publishDesignForVariant === "function") {
      const apiReady = await (window.waitDesignerReady?.(20000));
      if (!apiReady) throw new Error("designer-not-ready");
      const pub = await window.publishDesignForVariant(dp.variantId);
      if (!pub?.ok) throw new Error(pub?.error || "publish failed");
    }

    // 9) Redirigir a checkout o añadir al carrito
    const accIds = getAccessoryVariantIds();

    if (goToCheckout) {
      // POST /cart/add con return_to=/checkout (clásico Shopify)
      const SHOP = window.SHOP_DOMAIN || location.host;
      const form = document.createElement("form");
      form.method = "POST";
      form.target = "_top";
      form.action = `https://${SHOP}/cart/add`;

      const add = (n, v) => {
        const i = document.createElement("input");
        i.type = "hidden";
        i.name = n;
        i.value = String(v);
        form.appendChild(i);
      };

      let line = 0;
      const main = gidToNum(dp.variantId);
      add(`items[${line}][id]`, main);
      add(`items[${line}][quantity]`, String(quantity || 1));
      add(`items[${line}][properties][_LinePriority]`, "0");

      const getA = (name) => {
        const n = lower(name);
        return (emailAttrs.find((a) => {
          const k = lower(a.key || "");
          return k === n || k === `_${n}`;
        })?.value) || "";
      };

      // Properties clave (con alias)
      const previewUrl = getA("DesignPreview");
      const designId   = getA("DesignId");
      const designPlant= getA("DesignPlant");
      const designPot  = getA("DesignPot");
      const designColor= getA("DesignColor");
      const designSize = getA("DesignSize");
      const layerImg   = getA("Layer:Image") || getA("LayerImage");
      const layerTxt   = getA("Layer:Text")  || getA("LayerText");
      if (previewUrl) add(`items[${line}][properties][_DesignPreview]`, previewUrl);
      if (designId)   add(`items[${line}][properties][_DesignId]`, designId);
      if (designPlant)add(`items[${line}][properties][_DesignPlant]`, designPlant);
      if (designPot)  add(`items[${line}][properties][_DesignPot]`, designPot);
      if (designColor)add(`items[${line}][properties][_DesignColor]`, designColor);
      if (designSize) add(`items[${line}][properties][_DesignSize]`, designSize);
      if (layerImg)   add(`items[${line}][properties][_LayerImage]`, layerImg);
      if (layerTxt)   add(`items[${line}][properties][_LayerText]`, layerTxt);
      line++;

      accIds.forEach((id) => {
        add(`items[${line}][id]`, id);
        add(`items[${line}][quantity]`, "1");
        add(`items[${line}][properties][_Accessory]`, "true");
        add(`items[${line}][properties][_LinePriority]`, "1");
        line++;
      });

      add("return_to", "/checkout");
      document.body.appendChild(form);
      form.submit();
    } else {
      // Añadir al carrito y quedarse en /cart
      const SHOP = window.SHOP_DOMAIN || location.host;
      const form = document.createElement("form");
      form.method = "POST";
      form.target = "_top";
      form.action = `https://${SHOP}/cart/add`;

      const add = (n, v) => {
        const i = document.createElement("input");
        i.type = "hidden";
        i.name = n;
        i.value = String(v);
        form.appendChild(i);
      };

      let line = 0;
      const main = gidToNum(dp.variantId);
      add(`items[${line}][id]`, main);
      add(`items[${line}][quantity]`, String(quantity || 1));
      add(`items[${line}][properties][_LinePriority]`, "0");

      const getA = (name) => {
        const n = lower(name);
        return (emailAttrs.find((a) => {
          const k = lower(a.key || "");
          return k === n || k === `_${n}`;
        })?.value) || "";
      };

      const previewUrl = getA("DesignPreview");
      const designId   = getA("DesignId");
      const designPlant= getA("DesignPlant");
      const designPot  = getA("DesignPot");
      const designColor= getA("DesignColor");
      const designSize = getA("DesignSize");
      const layerImg   = getA("Layer:Image") || getA("LayerImage");
      const layerTxt   = getA("Layer:Text")  || getA("LayerText");
      if (previewUrl) add(`items[${line}][properties][_DesignPreview]`, previewUrl);
      if (designId)   add(`items[${line}][properties][_DesignId]`, designId);
      if (designPlant)add(`items[${line}][properties][_DesignPlant]`, designPlant);
      if (designPot)  add(`items[${line}][properties][_DesignPot]`, designPot);
      if (designColor)add(`items[${line}][properties][_DesignColor]`, designColor);
      if (designSize) add(`items[${line}][properties][_DesignSize]`, designSize);
      if (layerImg)   add(`items[${line}][properties][_LayerImage]`, layerImg);
      if (layerTxt)   add(`items[${line}][properties][_LayerText]`, layerTxt);
      line++;

      accIds.forEach((id) => {
        add(`items[${line}][id]`, id);
        add(`items[${line}][quantity]`, "1");
        add(`items[${line}][properties][_Accessory]`, "true");
        add(`items[${line}][properties][_LinePriority]`, "1");
        line++;
      });

      add("return_to", "/cart");
      document.body.appendChild(form);
      form.submit();
    }
  };

  // ===== Handlers públicos =====
  const buyNow = async () => {
    try { await runPurchase({ goToCheckout: true }); }
    catch (e) { alert(`No se pudo iniciar el checkout: ${e.message}`); }
  };

  const addToCart = async () => {
    try { await runPurchase({ goToCheckout: false }); }
    catch (e) { alert(`No se pudo añadir: ${e.message}`); }
  };

  // Exponer handlers para tus botones existentes
  useEffect(() => {
    window.buyNow = buyNow;
    window.addToCart = addToCart;
  }, []);

  // Tu UI (no la cambiamos)
  return (
    <div ref={stageRef} data-stage-root style={{ width: "100%", maxWidth: 520, margin: "0 auto" }}>
      {/* Aquí va tu overlay/selector/preview ya existente */}
      {/* Mantén tus botones tal como están; llaman window.buyNow / window.addToCart */}
    </div>
  );
}
