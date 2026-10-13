/*!
 * FilmHall Odisha — shared page helper.
 *
 * Small, dependency-free utilities used by the inner pages (theatre,
 * community, development) to read published content from the public CMS.
 * The home page keeps its own loader (content.js); this file only exists so
 * the new pages do not repeat fetch/media/URL logic three times.
 *
 * Environment comes from config.js:
 *   window.FILMHALL_CMS_ORIGIN  e.g. https://api.filmhall.in
 *   window.FILMHALL_CMS_REGION  e.g. odisha
 */
(function () {
  "use strict";

  var ORIGIN = String(window.FILMHALL_CMS_ORIGIN || "https://api.filmhall.in").replace(/\/+$/, "");
  var REGION = String(window.FILMHALL_CMS_REGION || "odisha");
  var DATA = String(window.FILMHALL_SITE_DATA || "data").replace(/\/+$/, "");
  var BASE = DATA + "/" + encodeURIComponent(REGION);
  var REGIONS_URL = DATA + "/regions.json";
  var MEDIA = {};
  var TIMEOUT_MS = 8000;

  function getJSON(url) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, TIMEOUT_MS) : null;
    return fetch(url, {
      method: "GET",
      credentials: "omit",
      mode: "cors",
      cache: "no-cache",
      headers: { Accept: "application/json" },
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }, function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  function mediaUrl(id) {
    var key = String(id);
    if (MEDIA[key]) return MEDIA[key];
    return ORIGIN + "/cms/public/media/" + encodeURIComponent(key) + "/file";
  }

  function setMedia(map) {
    if (!map || typeof map !== "object") return;
    for (var key in map) {
      if (Object.prototype.hasOwnProperty.call(map, key)) MEDIA[key] = map[key];
    }
  }

  function safeUrl(value, base) {
    if (typeof value !== "string") return null;
    var s = value.trim();
    if (!s) return null;
    try {
      var url = new URL(s, base || ORIGIN);
      if (url.protocol === "http:" || url.protocol === "https:") return url.href;
    } catch (e) { /* ignore */ }
    return null;
  }

  function firstUrl(map) {
    if (!map || typeof map !== "object") return null;
    var keys = ["website", "url", "facebook", "youtube", "instagram", "twitter", "telegram"];
    var i, found;
    for (i = 0; i < keys.length; i++) {
      found = safeUrl(map[keys[i]]);
      if (found) return found;
    }
    var names = Object.keys(map);
    for (i = 0; i < names.length; i++) {
      found = safeUrl(map[names[i]]);
      if (found) return found;
    }
    return null;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function param(name) {
    var m = new RegExp("[?&]" + name.replace(/[^a-zA-Z0-9_]/g, "") + "=([^&]*)").exec(
      window.location.search || "");
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
  }

  function guardImage(img, fallback) {
    img.addEventListener("error", function onErr() {
      img.removeEventListener("error", onErr);
      if (img.getAttribute("src") !== fallback) img.src = fallback;
    });
  }

  function assignImage(img, id, fallback) {
    guardImage(img, fallback || "logo.png");
    if (id) img.src = mediaUrl(id);
  }

  function text(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") return value.trim() || null;
    if (typeof value === "object" && typeof value.text === "string") {
      return value.text.trim() || null;
    }
    return null;
  }

  function metaText(parts) {
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var v = parts[i];
      if (v === null || v === undefined) continue;
      var s = String(v).trim();
      if (s) out.push(s);
    }
    return out.length ? out.join(" \u00B7 ") : null;
  }

  function showMessage(container, message) {
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(el("p", "page-message", message));
  }

  window.FilmHall = {
    origin: ORIGIN,
    region: REGION,
    data: DATA,
    base: BASE,
    regionsUrl: REGIONS_URL,
    getJSON: getJSON,
    setMedia: setMedia,
    mediaUrl: mediaUrl,
    safeUrl: safeUrl,
    firstUrl: firstUrl,
    el: el,
    qs: qs,
    param: param,
    guardImage: guardImage,
    assignImage: assignImage,
    text: text,
    metaText: metaText,
    showMessage: showMessage
  };
})();
