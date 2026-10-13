/*!
 * FilmHall Odisha — community page.
 *
 * Lists the community members HQ published, grouped by category
 * (Production House, Producer, Filmmakers, Film Persons, ...). The category
 * buttons are built from the CMS categories, so whatever HQ adds appears here.
 * Only approved, published members are returned by the public API.
 */
(function () {
  "use strict";

  var FH = window.FilmHall;
  var categories = [];
  var members = [];
  var active = null;

  function categoryLabel(id) {
    for (var i = 0; i < categories.length; i++) {
      if (String(categories[i].id) === String(id)) {
        return categories[i].label || categories[i].name || null;
      }
    }
    return null;
  }

  function memberCard(member) {
    var card = FH.el("div", "member-card");
    var photo = FH.el("img", "member-photo");
    photo.alt = member.name || "Community member";
    photo.loading = "lazy";
    FH.assignImage(photo, member.photo_media_id, "logo.png");
    card.appendChild(photo);

    card.appendChild(FH.el("h3", "member-name", member.name || "Member"));
    var meta = FH.metaText([categoryLabel(member.category_id),
                            member.meta_json && member.meta_json.district]);
    if (meta) card.appendChild(FH.el("p", "member-meta", meta));
    var bio = FH.text(member.bio);
    if (bio) card.appendChild(FH.el("p", "member-bio", bio));

    var link = FH.firstUrl(member.links_json);
    if (link) {
      var a = document.createElement("a");
      a.className = "member-link";
      a.href = link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Visit";
      card.appendChild(a);
    }
    return card;
  }

  function renderList() {
    var box = FH.qs("#community-list");
    if (!box) return;
    while (box.firstChild) box.removeChild(box.firstChild);

    var shown = members.filter(function (m) {
      return !active || String(m.category_id) === String(active);
    });
    var frag = document.createDocumentFragment();
    for (var i = 0; i < shown.length; i++) frag.appendChild(memberCard(shown[i]));
    box.appendChild(frag);
    box.removeAttribute("hidden");
  }

  function selectCategory(id, button) {
    active = id;
    var buttons = document.querySelectorAll(".cat-btn");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle("active", buttons[i] === button);
    }
    renderList();
  }

  function renderNav() {
    var nav = FH.qs("#category-nav");
    if (!nav) return;
    var list = categories.length ? categories : [];
    if (!list.length) return; // keep the static fallback labels

    while (nav.firstChild) nav.removeChild(nav.firstChild);
    var frag = document.createDocumentFragment();

    var all = FH.el("button", "cat-btn active", "All");
    all.type = "button";
    all.addEventListener("click", function () { selectCategory(null, all); });
    frag.appendChild(all);

    for (var i = 0; i < list.length; i++) {
      (function (cat) {
        var btn = FH.el("button", "cat-btn",
          cat.label || cat.name || "Category");
        btn.type = "button";
        btn.addEventListener("click", function () {
          selectCategory(cat.id, btn);
        });
        frag.appendChild(btn);
      })(list[i]);
    }
    nav.appendChild(frag);
    active = null;
  }

  function boot() {
    FH.getJSON(FH.base + "/home.json").then(function (payload) {
      FH.setMedia(payload && payload.media);
      categories = (payload && payload.categories) || [];
      members = (payload && payload.community) || [];
      renderNav();
      renderList();
      if (!members.length) {
        FH.showMessage(FH.qs("#community-list"),
          "No community members have been published yet.");
      }
    }).catch(function (err) {
      if (window.console && console.warn) {
        console.warn("[FilmHall community] not loaded:", err && err.message ? err.message : err);
      }
      FH.showMessage(FH.qs("#community-list"),
        "Community could not be loaded right now.");
    });
  }

  // Static fallback nav (no API): wire the buttons to show an empty message.
  document.addEventListener("DOMContentLoaded", function () {
    var nav = FH.qs("#category-nav");
    if (!nav) return;
    nav.addEventListener("click", function (event) {
      var btn = event.target.closest(".cat-btn");
      if (!btn) return;
      var label = btn.getAttribute("data-category");
      if (!label || categories.length) return;
      var buttons = nav.querySelectorAll(".cat-btn");
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle("active", buttons[i] === btn);
      }
      FH.showMessage(FH.qs("#community-list"),
        "No " + label + " entries published yet.");
    });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
