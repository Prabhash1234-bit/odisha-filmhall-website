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
  var GALLERY_CAP = 12;

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

    if (theatre.current_film_title) {
      info.appendChild(FH.el("p", "theatre-meta",
        "Now showing: " + theatre.current_film_title));
    }

    var meta2 = theatre.meta_json || {};
    var phone = firstText(meta2.phone, meta2.contact, meta2.contact_number, meta2.mobile);
    var waNumber = digits(firstText(meta2.whatsapp) || phone);
    if (waNumber.length === 10) waNumber = "91" + waNumber;

    if (phone || waNumber) {
      var telDigits = digits(phone || waNumber).replace(/^0+/, "");
      var actions = FH.el("div", "theatre-actions");

      if (telDigits) {
        var call = externalLink("Call to book", "tel:" + telDigits, "btn-primary");
        actions.appendChild(call);
      }
      if (waNumber) {
        var wa = externalLink("WhatsApp", "https://wa.me/" + waNumber, "whatsapp-btn");
        actions.appendChild(wa);
      }
      if (phone) {
        var label = FH.el("span", "contact-link", phone);
        actions.appendChild(label);
      }
      info.appendChild(actions);
    }

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

  /* ---------- main render ---------- */

  function renderTheatre(theatre, odishaLogoId, filmhallLogoId) {
    while (page.firstChild) page.removeChild(page.firstChild);

    page.appendChild(renderBrand(odishaLogoId, filmhallLogoId));
    page.appendChild(renderHero(theatre));

    renderGallery(theatre.gallery && theatre.gallery.items, theatre.name);

    var affinity = theatre.social_json || theatre.meta_json || {};
    renderSocial(buildSocial(affinity), theatre.name);
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

    var home = FH.getJSON(FH.base + "/home.json").then(function (payload) {
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
