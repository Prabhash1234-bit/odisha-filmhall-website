/*!
 * FilmHall Odisha — CMS content loader.
 *
 * Fetches published content from the FilmHall CMS public read API and hydrates
 * the existing markup in place. The static markup in index.html is the design
 * and the no-API fallback: if the API is unreachable, returns nothing, or the
 * page script fails, the site renders exactly as it did before this file existed.
 *
 * New sections (activities, community, documents) ship hidden and are only
 * revealed when the CMS actually has published rows for them.
 *
 * Content keys read from GET /cms/public/<region>/home:
 *   site.title, site.tagline, site.intro, site.logo, site.footer,
 *   home.banner, hall.section_title, activities.section_title,
 *   community.section_title, documents.section_title, links.section_title
 *
 * Text resolution order for a content row: summary -> title -> body_json.
 * site.logo and home.banner also use banner_media_id; home.banner may carry
 * meta_json.link for the banner anchor.
 */
(function () {
  "use strict";

  var ORIGIN = String(window.FILMHALL_CMS_ORIGIN || "https://api.filmhall.in").replace(/\/+$/, "");
  var REGION = String(window.FILMHALL_CMS_REGION || "odisha");
  var DATA = String(window.FILMHALL_SITE_DATA || "data").replace(/\/+$/, "");
  var BASE = DATA + "/" + encodeURIComponent(REGION);
  var FALLBACK_IMAGE = "logo.png";
  var MEDIA = {};
  var TIMEOUT_MS = 8000;

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

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function asText(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") {
      var s = value.trim();
      return s ? s : null;
    }
    if (typeof value !== "object") return String(value);
    if (typeof value.text === "string" && value.text.trim()) return value.text.trim();
    if (Array.isArray(value.blocks)) {
      var parts = [];
      for (var i = 0; i < value.blocks.length; i++) {
        var b = value.blocks[i];
        if (typeof b === "string") parts.push(b);
        else if (b && typeof b.text === "string") parts.push(b.text);
      }
      var joined = parts.join(" ").trim();
      return joined ? joined : null;
    }
    return null;
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

  function contentText(contents, key) {
    var row = contents[key];
    if (!row) return null;
    return asText(row.summary) || asText(row.title) || asText(row.body_json);
  }

  function contentMedia(contents, key) {
    var row = contents[key];
    return row && row.banner_media_id ? row.banner_media_id : null;
  }

  function contentLink(contents, key) {
    var row = contents[key];
    if (!row || !row.meta_json || typeof row.meta_json !== "object") return null;
    return safeUrl(row.meta_json.link || row.meta_json.url);
  }

  function firstHttpLink(map) {
    if (!map || typeof map !== "object") return null;
    var keys = ["website", "url", "facebook", "youtube", "instagram", "twitter", "telegram"];
    var i;
    for (i = 0; i < keys.length; i++) {
      var found = safeUrl(map[keys[i]]);
      if (found) return found;
    }
    var names = Object.keys(map);
    for (i = 0; i < names.length; i++) {
      var v = safeUrl(map[names[i]]);
      if (v) return v;
    }
    return null;
  }

  function guardImage(img, fallback) {
    img.addEventListener("error", function onErr() {
      img.removeEventListener("error", onErr);
      if (img.getAttribute("src") !== fallback) img.src = fallback;
    });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function formatDate(value) {
    if (!value) return null;
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  /* ---------- generic declarative hydration ---------- */

  function applyText(content) {
    var nodes = document.querySelectorAll("[data-cms]");
    for (var i = 0; i < nodes.length; i++) {
      var value = contentText(content, nodes[i].getAttribute("data-cms"));
      if (value) nodes[i].textContent = value;
    }
  }

  function applyImages(content) {
    var nodes = document.querySelectorAll("[data-cms-img]");
    for (var i = 0; i < nodes.length; i++) {
      var id = contentMedia(content, nodes[i].getAttribute("data-cms-img"));
      if (!id) continue;
      var img = nodes[i];
      img.setAttribute("data-cms-src", img.getAttribute("src") || "");
      guardImage(img, img.getAttribute("data-cms-src") || FALLBACK_IMAGE);
      img.src = mediaUrl(id);
    }
  }

  function applyLinks(content) {
    var nodes = document.querySelectorAll("[data-cms-link]");
    for (var i = 0; i < nodes.length; i++) {
      var href = contentLink(content, nodes[i].getAttribute("data-cms-link"));
      if (href) nodes[i].setAttribute("href", href);
    }
  }

  function applyLogo(content) {
    var id = contentMedia(content, "site.logo");
    var img = qs("header .logo");
    if (!id || !img) return;
    guardImage(img, "logo.png");
    img.src = mediaUrl(id);
  }

  function applyIntro(content) {
    var text = contentText(content, "site.intro");
    if (!text) return;
    var p = qs("header .tagline");
    if (!p) return;
    var existing = qs("header .intro");
    if (!existing) {
      existing = el("p", "intro");
      p.parentNode.insertBefore(existing, p.nextSibling);
    }
    existing.textContent = text;
  }

  function applyQuote(content) {
    var section = qs("#site-quote-section");
    if (!section) return;
    var row = content["home.quote"];
    if (!row) return;
    var text = asText(row.summary) || asText(row.body_json) || asText(row.title);
    if (!text) return;
    var quoteNode = qs("#site-quote");
    if (quoteNode) quoteNode.textContent = text;
    var author = asText(row.title) ||
                 asText(row.meta_json && row.meta_json.author) || null;
    var authorNode = qs("#site-quote-author");
    if (authorNode) authorNode.textContent = author ? "\u2014 " + author : "";
    section.removeAttribute("hidden");
  }

  /* ---------- theatre / development cards ---------- */

  function mediaIdOf(obj) {
    if (!obj) return null;
    return obj.photo_media_id || obj.current_film_media_id || obj.cover_media_id || null;
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

  function buildCard(opts) {
    var card = el("div", "hall-card" + (opts.extraClass ? " " + opts.extraClass : ""));
    var media = el("img");
    media.src = opts.image || FALLBACK_IMAGE;
    media.alt = opts.alt || opts.title || "";
    media.loading = "lazy";
    guardImage(media, FALLBACK_IMAGE);

    var heading = el("h3", null, opts.title);

    if (opts.href) {
      var a = document.createElement("a");
      a.setAttribute("href", opts.href);
      if (opts.newTab) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      a.appendChild(media);
      a.appendChild(heading);
      card.appendChild(a);
    } else {
      card.appendChild(media);
      card.appendChild(heading);
    }

    if (opts.meta) card.appendChild(el("p", "cms-meta", opts.meta));
    if (opts.detail) card.appendChild(el("p", "cms-meta", opts.detail));

    if (opts.action) {
      var btn = document.createElement("a");
      btn.className = opts.action.className;
      btn.href = opts.action.href;
      btn.textContent = opts.action.label;
      if (opts.action.newTab) {
        btn.target = "_blank";
        btn.rel = "noopener noreferrer";
      }
      card.appendChild(btn);
    }
    return card;
  }

  function renderTheatres(theatres) {
    var box = qs("#hall-container");
    if (!box || !theatres || !theatres.length) return false;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < theatres.length; i++) {
      var t = theatres[i];
      var action = t.ticket_generator_url
        ? { className: "ticket-btn", href: safeUrl(t.ticket_generator_url), label: "GET TICKET", newTab: true }
        : null;
      if (action && !action.href) action = null;
      frag.appendChild(buildCard({
        title: t.name,
        image: mediaIdOf(t) ? mediaUrl(mediaIdOf(t)) : null,
        alt: t.name,
        href: "theatre.html?id=" + encodeURIComponent(String(t.theatre_id || t.id || "")),
        meta: metaText([t.district, t.current_film_title]),
        action: action
      }));
    }
    while (box.firstChild) box.removeChild(box.firstChild);
    box.appendChild(frag);
    return true;
  }

  function renderCollection(sectionId, containerId, rows, builder) {
    var section = qs("#" + sectionId);
    var box = qs("#" + containerId);
    if (!section || !box) return;
    if (!rows || !rows.length) return;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < rows.length; i++) {
      var node = builder(rows[i]);
      if (node) frag.appendChild(node);
    }
    if (!frag.childNodes.length) return;
    box.appendChild(frag);
    section.removeAttribute("hidden");
  }

  function categoryLabel(categories, id) {
    if (!id || !categories) return null;
    for (var i = 0; i < categories.length; i++) {
      if (String(categories[i].id) === String(id) || String(categories[i].category_id) === String(id)) {
        return categories[i].label || categories[i].name || null;
      }
    }
    return null;
  }

  function renderActivity(a) {
    var bits = [formatDate(a.when_start), metaText([a.district, a.venue])];
    return buildCard({
      title: a.title,
      image: a.cover_media_id ? mediaUrl(a.cover_media_id) : null,
      alt: a.title,
      meta: a.summary || null,
      detail: metaText(bits)
    });
  }

  function renderMember(m, categories) {
    var link = firstHttpLink(m.links_json);
    return buildCard({
      title: m.name,
      image: m.photo_media_id ? mediaUrl(m.photo_media_id) : null,
      alt: m.name,
      href: link,
      newTab: true,
      meta: categoryLabel(categories, m.category_id),
      detail: metaText([m.meta_json && m.meta_json.district, asText(m.bio)])
    });
  }

  function renderDocument(d) {
    var href = d.doc_media_id ? mediaUrl(d.doc_media_id) : null;
    if (!href && !d.title) return null;
    return buildCard({
      title: d.title || "Document",
      image: FALLBACK_IMAGE,
      alt: d.title || "Document",
      href: href,
      newTab: true,
      meta: d.summary || null,
      detail: d.version ? "v" + d.version : null
    });
  }

  /* ---------- social / links ---------- */

  function linkClass(link) {
    var key = String(link.rel || link.icon_key || link.title || "").toLowerCase();
    if (key.indexOf("face") !== -1) return "fb";
    if (key.indexOf("you") !== -1 || key.indexOf("tube") !== -1) return "yt";
    if (key.indexOf("insta") !== -1) return "ig";
    var slug = key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return slug || "link";
  }

  function renderLinks(links) {
    if (!links || !links.length) return;
    var box = qs(".social .icons");
    if (!box) return;
    var rendered = document.createDocumentFragment();
    for (var i = 0; i < links.length; i++) {
      var href = safeUrl(links[i].url);
      if (!href) continue;
      var a = document.createElement("a");
      a.className = linkClass(links[i]);
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = links[i].title || linkClass(links[i]);
      rendered.appendChild(a);
    }
    if (!rendered.childNodes.length) return;
    while (box.firstChild) box.removeChild(box.firstChild);
    box.appendChild(rendered);
  }

  /* ---------- boot ---------- */

  function loadHome() {
    if (typeof fetch !== "function") return Promise.reject(new Error("no fetch"));
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, TIMEOUT_MS) : null;
    return fetch(BASE + "/home.json", {
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

  function hydrate(payload) {
    if (!payload || typeof payload !== "object") return;
    setMedia(payload.media);
    var contents = payload.contents || {};
    var links = payload.links || [];

    applyText(contents);
    applyImages(contents);
    applyLinks(contents);
    applyLogo(contents);
    applyIntro(contents);
    applyQuote(contents);

    renderTheatres(payload.theatres || []);

    renderCollection("activities-section", "activities-container", payload.activities, function (a) {
      return renderActivity(a);
    });
    renderCollection("community-section", "community-container", payload.community, function (m) {
      return renderMember(m, payload.categories || []);
    });
    renderCollection("documents-section", "documents-container", payload.documents, renderDocument);

    renderLinks(links);
  }

  function boot() {
    try {
      loadHome().then(hydrate).catch(function (err) {
        if (window.console && console.warn) console.warn("[FilmHall CMS] content not loaded:", err && err.message ? err.message : err);
      });
    } catch (e) {
      if (window.console && console.warn) console.warn("[FilmHall CMS] content loader failed:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
