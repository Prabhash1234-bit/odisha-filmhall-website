/*!
 * FilmHall Odisha — theatre page (page 3).
 *
 * One theatre's public page: GET /cms/public/<region>/theatres/<theatre_id>.
 *
 * Layout:
 *   brand   - the big FilmHall Odisha logo beside a small FilmHall wordmark
 *   hero    - the theatre photo HQ uploaded, name, district/owner, status,
 *             plus Call + WhatsApp buttons so a visitor books by phone
 *   gallery - published photos the owner uploaded for this hall
 *   social  - Facebook / Instagram / YouTube: an embed when the owner saved a
 *             post link, otherwise a plain button
 *
 * Read-only: the owner sets these values in the owner app, never on this
 * page. Every URL is validated so a stored javascript:/data: link can never
 * run here.
 */
(function () {
  "use strict";

  var FH = window.FilmHall;
  var page = null;
  var GALLERY_CAP = 4;

  function statusChip(status) {
    var value = String(status || "").toLowerCase();
    if (!value) return null;
    var label = value.charAt(0).toUpperCase() + value.slice(1);
    return FH.el("span", "status-chip status-" + value, label);
  }

  function firstText() {
    for (var i = 0; i < arguments.length; i++) {
      var v = FH.text(arguments[i]);
      if (v) return v;
    }
    return null;
  }

  function digits(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/[^0-9]/g, "");
  }

  function openableUrl(value) {
    var direct = FH.safeUrl(value);
    if (direct) return direct;
    if (value && typeof value === "object") return FH.firstUrl(value);
    return null;
  }

  /* ---------- helpers ---------- */

  function youtubeEmbed(url) {
    var m = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/.exec(url);
    if (!m) return null;
    var frame = document.createElement("iframe");
    frame.className = "embed-frame yt-frame";
    frame.setAttribute("src", "https://www.youtube.com/embed/" + m[1]);
    frame.setAttribute("width", "560");
    frame.setAttribute("height", "315");
    frame.setAttribute("frameborder", "0");
    frame.setAttribute("allowfullscreen", "1");
    return frame;
  }

  function facebookEmbed(url) {
    if (!/facebook\.com\//.test(url)) return null;
    var post = /(?:posts|photos|videos|share)\/\S*/.test(url.replace(/\?.*$/, ""));
    if (!post) return null;
    var frame = document.createElement("iframe");
    frame.className = "embed-frame fb-frame";
    frame.setAttribute("src", "https://www.facebook.com/plugins/post.php?href=" +
      encodeURIComponent(url) + "&show_text=true&width=500");
    frame.setAttribute("width", "500");
    frame.setAttribute("height", "520");
    frame.setAttribute("frameborder", "0");
    frame.setAttribute("scrolling", "no");
    frame.setAttribute("style", "color-scheme: light;");
    return frame;
  }

  function instagramEmbed(url) {
    var m = /instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)\//.exec(url);
    if (!m) return null;
    var frame = document.createElement("iframe");
    frame.className = "embed-frame ig-frame";
    frame.setAttribute("src", "https://www.instagram.com/p/" + m[1] + "/embed/");
    frame.setAttribute("width", "400");
    frame.setAttribute("height", "560");
    frame.setAttribute("frameborder", "0");
    frame.setAttribute("scrolling", "no");
    return frame;
  }

  function externalLink(text, url, cls) {
    var a = document.createElement("a");
    a.className = cls || "embed-link";
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = text;
    return a;
  }

  /* ---------- brand bar (big Odisha logo + small FilmHall wordmark) ---------- */

  function renderBrand(odishaLogoId, filmhallLogoId) {
    var bar = FH.el("section", "brand-bar");

    var big = FH.el("img", "brand-odisha");
    big.alt = "FilmHall Odisha";
    FH.assignImage(big, odishaLogoId, "logo.png");
    /* No logo saved in the content yet: show the FilmHall logo that ships with the site. */
    if (!odishaLogoId) big.src = "logo.png";
    bar.appendChild(big);

    if (filmhallLogoId) {
      bar.appendChild(FH.el("span", "brand-divider"));
      var small = FH.el("img", "brand-filmhall");
      small.alt = "FilmHall";
      FH.assignImage(small, filmhallLogoId, "logo.png");
      bar.appendChild(small);
    }
    return bar;
  }

  /* ---------- hero (theatre photo + name + Call / WhatsApp) ---------- */

  function renderHero(theatre) {
    var hero = FH.el("section", "theatre-hero");

    var photo = FH.el("img", "theatre-photo");
    photo.alt = theatre.name || "FilmHall";
    FH.assignImage(photo, theatre.photo_media_id, "logo.png");
    hero.appendChild(photo);

    var info = FH.el("div", "theatre-info");
    info.appendChild(FH.el("h1", "theatre-name", theatre.name || "FilmHall"));

    var meta = FH.metaText([theatre.owner_name, theatre.district]);
    if (meta) info.appendChild(FH.el("p", "theatre-meta", meta));

    var chip = statusChip(theatre.status);
    if (chip) info.appendChild(chip);

    hero.appendChild(info);
    return hero;
  }

  /* ---------- gallery ---------- */

  function renderGallery(items, name) {
    if (!items || !items.length) return;
    var section = FH.el("section", "gallery-section");
    section.appendChild(FH.el("h2", "gallery-title", "Gallery"));

    var grid = FH.el("div", "gallery-grid");
    items.slice(0, GALLERY_CAP).forEach(function (item) {
      var url = FH.mediaUrl(item.id);
      var link = document.createElement("a");
      link.className = "gallery-item";
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      var img = FH.el("img", "gallery-img");
      img.alt = FH.text(item.alt_text) || name + " photo";
      img.loading = "lazy";
      FH.assignImage(img, item.id, "logo.png");
      link.appendChild(img);
      grid.appendChild(link);
    });
    section.appendChild(grid);
    page.appendChild(section);
  }

  /* ---------- social ---------- */

  function buildSocial(source) {
    var out = { facebook: [], instagram: [], youtube: [] };
    ["facebook", "instagram", "youtube"].forEach(function (key) {
      var value = source ? source[key] : null;
      var list = Array.isArray(value) ? value
        : (typeof value === "string" ? [value] : []);
      list.forEach(function (u) {
        var fixed = openableUrl(u);
        if (fixed && out[key].indexOf(fixed) === -1) out[key].push(fixed);
      });
    });
    return out;
  }

  function renderSocial(social, name) {
    var label = { facebook: "Facebook", instagram: "Instagram", youtube: "YouTube" };
    var keys = Object.keys(social).filter(function (k) { return social[k].length; });
    if (!keys.length) return;

    var section = FH.el("section", "social-feed");
    section.appendChild(FH.el("h2", "social-feed-title",
      "Latest from " + (name || "FilmHall")));

    var tabs = FH.el("div", "social-tabs");
    var panel = FH.el("div", "social-panel");
    var embedsByKey = {};

    keys.forEach(function (key) {
      var embeds = [];
      social[key].forEach(function (url) {
        var frame = null;
        if (key === "youtube") frame = youtubeEmbed(url);
        else if (key === "facebook") frame = facebookEmbed(url);
        else frame = instagramEmbed(url);

        if (frame) {
          var wrap = FH.el("div", "embed-item");
          wrap.appendChild(frame);
          embeds.push(wrap);
        } else {
          var text = key === "youtube" ? "Watch on YouTube"
            : key === "facebook" ? "Open on Facebook"
              : "Open on Instagram";
          embeds.push(externalLink(text, url, "embed-link"));
        }
      });
      embedsByKey[key] = embeds;

      var tab = FH.el("button", "social-tab", label[key]);
      tab.type = "button";
      tab.addEventListener("click", function () {
        var active = tabs.querySelector(".social-tab-active");
        if (active) active.classList.remove("social-tab-active");
        tab.classList.add("social-tab-active");
        while (panel.firstChild) panel.removeChild(panel.firstChild);
        embedsByKey[key].forEach(function (node) { panel.appendChild(node); });
      });
      tabs.appendChild(tab);
    });

    section.appendChild(tabs);
    section.appendChild(panel);
    page.appendChild(section);

    var first = tabs.querySelector(".social-tab");
    if (first) first.click();
  }

  /* ---------- Book ticket (Call + WhatsApp, plus Book online when a link is set) ---------- */

  function renderBook(theatre) {
    var m = theatre.meta_json || {};
    var phone = firstText(m.phone, m.contact, m.contact_number, m.mobile);
    var wa = firstText(m.whatsapp) || phone;
    var waNumber = digits(wa);
    if (waNumber.length === 10) waNumber = "91" + waNumber;
    var ticket = FH.safeUrl(theatre.ticket_generator_url);
    var telDigits = digits(phone || wa).replace(/^0+/, "");
    if (!ticket && !telDigits && !waNumber) return;

    var section = FH.el("section", "book-section");
    section.appendChild(FH.el("h2", "gallery-title", "Book ticket"));
    var actions = FH.el("div", "theatre-actions");
    if (ticket) actions.appendChild(externalLink("Book online", ticket, "btn-primary"));
    if (telDigits) actions.appendChild(externalLink("Call " + (phone || telDigits), "tel:" + telDigits, "btn-primary"));
    if (waNumber) actions.appendChild(externalLink("WhatsApp " + (wa || ""), "https://wa.me/" + waNumber, "whatsapp-btn"));
    section.appendChild(actions);
    page.appendChild(section);
  }

  /* ---------- film poster (the film now showing) ---------- */

  function renderPoster(theatre) {
    if (!theatre.current_film_media_id) return;
    var section = FH.el("section", "poster-section");
    section.appendChild(FH.el("h2", "gallery-title", "Now showing"));
    var img = FH.el("img", "film-poster");
    img.alt = theatre.current_film_title || "Film poster";
    FH.assignImage(img, theatre.current_film_media_id, "logo.png");
    var full = document.createElement("a");
    full.href = FH.mediaUrl(theatre.current_film_media_id);
    full.target = "_blank"; full.rel = "noopener noreferrer"; full.title = "Open the full poster";
    full.appendChild(img);
    section.appendChild(full);
    if (theatre.current_film_title) section.appendChild(FH.el("p", "poster-title", theatre.current_film_title));
    page.appendChild(section);
  }

  /* ---------- Join with us (F / Y / I buttons) ---------- */

  function renderJoin(social) {
    /* Standard Facebook / YouTube / Instagram symbols as small vector icons (white on each brand's colour). */
    var items = [
      ["facebook", "Facebook", "join-fb", "https://www.facebook.com/share/17n2kYjxau/",
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#fff" d="M13.6 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.6V21h3z"/></svg>'],
      ["youtube", "YouTube", "join-yt", "https://youtube.com/@filmhallodisha",
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2" y="5" width="20" height="14" rx="4.2" fill="#fff"/><path fill="#FF0000" d="M10 9l5.4 3-5.4 3z"/></svg>'],
      ["instagram", "Instagram", "join-ig", "https://www.instagram.com/filmhallodisha",
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="3.9" fill="none" stroke="#fff" stroke-width="2"/><circle cx="17.1" cy="6.9" r="1.2" fill="#fff"/></svg>']
    ];
    var row = FH.el("div", "join-row");
    items.forEach(function (it) {
      /* the hall's own page if it has one, otherwise the FilmHall Odisha page */
      var url = (social[it[0]] && social[it[0]][0]) || it[3];
      var a = externalLink("", url, "join-btn " + it[2]);
      a.innerHTML = it[4];
      a.setAttribute("aria-label", it[1]);
      a.title = it[1];
      row.appendChild(a);
    });
    var section = FH.el("section", "join-section");
    section.appendChild(FH.el("h2", "gallery-title", "Join with us"));
    section.appendChild(row);
    page.appendChild(section);
  }

  /* ---------- main render ---------- */

  function renderTheatre(theatre, odishaLogoId, filmhallLogoId) {
    while (page.firstChild) page.removeChild(page.firstChild);

    page.appendChild(renderBrand(odishaLogoId, filmhallLogoId));
    page.appendChild(renderHero(theatre));
    renderBook(theatre);
    renderPoster(theatre);
    renderGallery(theatre.gallery && theatre.gallery.items, theatre.name);

    var own = theatre.social_json || {}, meta = theatre.meta_json || {}, merged = {};
    ["facebook", "instagram", "youtube"].forEach(function (k) { merged[k] = own[k] || meta[k]; });
    renderJoin(buildSocial(merged));
  }

  function boot() {
    page = FH.qs("#theatre-page");
    if (!page) return;

    var id = FH.param("id");
    if (!id) {
      FH.showMessage(page, "No theatre selected.");
      return;
    }

    var odishaLogoId = null;
    var filmhallLogoId = null;

    var homePayload = null;
    var home = FH.getJSON(FH.base + "/home.json").then(function (payload) {
      homePayload = payload;
      FH.setMedia(payload && payload.media);
      var contents = (payload && payload.contents) || {};
      var logoRow = contents["site.logo"];
      if (logoRow && logoRow.banner_media_id) odishaLogoId = logoRow.banner_media_id;
    }).catch(function () { /* falls back to the shipped logo */ });

    var regions = FH.getJSON(FH.regionsUrl).then(function (payload) {
      FH.setMedia(payload && payload.media);
      var brand = payload && payload.brand;
      if (brand && brand.logo_media_id) filmhallLogoId = brand.logo_media_id;
    }).catch(function () { /* small wordmark hidden */ });

    var theatre = FH.getJSON(
      FH.base + "/theatre/" + encodeURIComponent(id) + ".json"
    ).then(function (payload) {
      FH.setMedia(payload && payload.media);
      return payload;
    }).catch(function () {
      /* No separate file for this hall yet: use its row from home.json. */
      return home.then(function () {
        var rows = (homePayload && homePayload.theatres) || [];
        for (var i = 0; i < rows.length; i++) {
          if ((rows[i].theatre_id || rows[i].id) === id) return rows[i];
        }
        throw new Error("not found");
      });
    });

    Promise.all([home, regions, theatre]).then(function (result) {
      var row = result[2];
      if (!row) throw new Error("not found");
      renderTheatre(row, odishaLogoId, filmhallLogoId);
    }).catch(function (err) {
      if (window.console && console.warn) {
        console.warn("[FilmHall theatre] not loaded:",
          err && err.message ? err.message : err);
      }
      FH.showMessage(page, "This theatre could not be loaded.");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
    
