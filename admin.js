/* FilmHall Odisha admin panel.
   Login -> dashboard showing the current text, photos and links -> edit -> Save.
   Everything is saved to the FilmHall CMS (api.filmhall.in), the same place the HQ app writes to. */
(function () {
  "use strict";

  var ORIGIN = String(window.FILMHALL_CMS_ORIGIN || "https://api.filmhall.in").replace(/\/+$/, "");
  var REGION = String(window.FILMHALL_CMS_REGION || "odisha");
  var DATA = String(window.FILMHALL_SITE_DATA || "data").replace(/\/+$/, "") + "/" + encodeURIComponent(REGION);
  var TOKEN_KEY = "fh_admin_token";
  var enc = encodeURIComponent;

  /* API routes. login, media and theatre are the same calls edit.js already makes.
     The routes marked GUESS are assumptions: if your API uses other paths, change them here only. */
  var ROUTES = {
    login: "/cms/auth/login",
    media: "/cms/media",
    theatre: function (id) { return "/cms/theatres/" + enc(id); },
    contentNew: "/cms/contents",                                     // GUESS
    content: function (id) { return "/cms/contents/" + enc(id); },   // GUESS
    linkNew: "/cms/links",                                           // GUESS
    link: function (id) { return "/cms/links/" + enc(id); }          // GUESS
  };

  var HOME_FIELDS = [
    { key: "site.title", label: "Site title", kind: "text" },
    { key: "site.tagline", label: "Tagline", kind: "area" },
    { key: "site.intro", label: "Intro paragraph", kind: "area" },
    { key: "site.logo", label: "Logo", kind: "image" },
    { key: "home.banner", label: "Banner photo and its link", kind: "image", link: true },
    { key: "home.quote", label: "Quote (and author)", kind: "area", author: true },
    { key: "hall.section_title", label: "Film halls heading", kind: "text" },
    { key: "activities.section_title", label: "Activities heading", kind: "text" },
    { key: "community.section_title", label: "Community heading", kind: "text" },
    { key: "documents.section_title", label: "Documents heading", kind: "text" },
    { key: "links.section_title", label: "Follow Us heading", kind: "text" },
    { key: "site.footer", label: "Footer text", kind: "text" }
  ];

  var app = document.getElementById("app");
  var H = { contents: {}, theatres: [], links: [] };
  var MEDIA = {};
  var tab = "home";

  /* ---------- helpers ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }
  function toast(msg, isErr) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.className = isErr ? "err" : ""; t.style.display = "block";
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.style.display = "none"; }, 3500);
  }
  function mediaUrl(id) { return MEDIA[id] || ORIGIN + "/cms/public/media/" + enc(id) + "/file"; }
  function plain(v) {
    if (v == null) return "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "object" && typeof v.text === "string") return v.text.trim();
    return "";
  }
  function getJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }
  function api(path, opt) {
    opt = opt || {};
    var h = opt.headers || {};
    if (!opt.noAuth) h.Authorization = "Bearer " + (sessionStorage.getItem(TOKEN_KEY) || "");
    opt.headers = h; opt.credentials = "omit"; opt.mode = "cors";
    return fetch(ORIGIN + path, opt).then(function (res) {
      return res.text().then(function (body) {
        var d = null;
        try { d = body ? JSON.parse(body) : null; } catch (e) { d = null; }
        if (res.status === 401 && !opt.noAuth) { logout("Session ended. Please log in again."); throw new Error("Session ended"); }
        if (!res.ok) {
          var det = d && d.detail;
          throw new Error(typeof det === "string" ? det : "Could not save (HTTP " + res.status + "). Check the route list at the top of admin.js.");
        }
        return d;
      });
    });
  }
  function upload(file, kind, theatreId) {
    var q = "?region=" + enc(REGION) + "&kind=" + kind + "&filename=" + enc(file.name) +
            (theatreId ? "&owner_theatre_id=" + enc(theatreId) : "");
    return api(ROUTES.media + q, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file })
      .then(function (r) {
        var id = r && (r.id || r.media_id);
        if (!id) throw new Error("Upload worked but no media id came back.");
        return id;
      });
  }
  function field(label, node) {
    var w = el("div"); w.appendChild(el("label", null, label)); w.appendChild(node); return w;
  }
  function input(value, type) {
    var i = el("input"); i.type = type || "text"; i.value = value || ""; return i;
  }
  function area(value) { var a = el("textarea"); a.value = value || ""; return a; }
  function fileInput(multiple, accept) {
    var f = el("input"); f.type = "file"; f.accept = accept || "image/*"; f.multiple = !!multiple; return f;
  }
  function thumb(id) {
    var img = el("img", "thumb"); img.alt = "";
    if (id) img.src = mediaUrl(id);
    return img;
  }
  function busy(btn, work) {
    btn.disabled = true;
    return work().then(function () { toast("Saved"); }, function (e) { if (e.message !== "Session ended") toast(e.message, true); })
      .then(function () { btn.disabled = false; });
  }

  /* ---------- login ---------- */
  function logout(msg) {
    sessionStorage.removeItem(TOKEN_KEY);
    showLogin(msg);
  }
  function showLogin(msg) {
    app.replaceChildren();
    var box = el("div"); box.id = "login";
    var card = el("div", "card");
    card.appendChild(el("h2", null, "FilmHall Odisha admin"));
    card.appendChild(el("p", "muted", msg || "Sign in to edit the website."));
    var u = input("", "text"); u.autocomplete = "username";
    var p = input("", "password"); p.autocomplete = "current-password";
    var b = el("button", "primary", "Log in"); b.style.marginTop = "12px";
    function go() {
      busy(b, function () {
        return api(ROUTES.login, { method: "POST", noAuth: true, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle: u.value.trim(), password: p.value }) })
          .then(function (d) { sessionStorage.setItem(TOKEN_KEY, d.token); return start(); });
      });
    }
    b.onclick = go; p.onkeydown = function (e) { if (e.key === "Enter") go(); };
    card.appendChild(field("Username", u)); card.appendChild(field("Password", p)); card.appendChild(b);
    var back = el("a", "muted", "Back to the website"); back.href = "index.html"; back.style.display = "block"; back.style.marginTop = "12px";
    card.appendChild(back);
    box.appendChild(card); app.appendChild(box);
  }

  /* ---------- load current content ---------- */
  function load() {
    return getJSON(ORIGIN + "/cms/public/" + enc(REGION) + "/home")
      .catch(function () { return getJSON(DATA + "/home.json"); })
      .then(function (p) { H = p || H; MEDIA = Object.assign({}, H.media || {}); });
  }
  function start() { return load().then(render); }

  /* ---------- shell ---------- */
  function render() {
    app.replaceChildren();
    var head = el("header"), bar = el("div", "bar");
    var logo = el("img"); logo.src = "logo.png"; logo.alt = "";
    var out = el("button", null, "Log out"); out.onclick = function () { logout("You are logged out."); };
    bar.appendChild(logo); bar.appendChild(el("h1", null, "Website admin")); bar.appendChild(out);
    var tabs = el("div", "tabs");
    [["home", "Home page"], ["halls", "Film halls"], ["social", "Social links"], ["more", "Other sections"]].forEach(function (t) {
      var b = el("button", tab === t[0] ? "on" : "", t[1]);
      b.onclick = function () { tab = t[0]; render(); };
      tabs.appendChild(b);
    });
    head.appendChild(bar); head.appendChild(tabs);
    var main = el("main");
    ({ home: homeTab, halls: hallsTab, social: socialTab, more: moreTab })[tab](main);
    app.appendChild(head); app.appendChild(main);
  }

  /* ---------- Home page tab ---------- */
  function homeTab(main) {
    HOME_FIELDS.forEach(function (f) {
      var row = H.contents[f.key] || null;
      var card = el("div", "card");
      card.appendChild(el("h2", null, f.label));
      card.appendChild(el("p", "muted", f.key));

      var current = f.author ? plain(row && (row.summary || row.body_json)) : plain(row && (row.summary || row.title || row.body_json));
      var text = null, author = null, link = null, file = null;
      if (f.kind === "image") {
        var prev = thumb(row && row.banner_media_id);
        file = fileInput(false);
        var r = el("div", "row"); r.appendChild(prev); r.appendChild(file); card.appendChild(r);
        if (f.link) {
          link = input(row && row.meta_json && (row.meta_json.link || row.meta_json.url), "url");
          card.appendChild(field("Link when the photo is clicked", link));
        }
      } else {
        text = f.kind === "area" ? area(current) : input(current);
        card.appendChild(text);
        if (f.author) {
          author = input(row && (row.title || (row.meta_json && row.meta_json.author)));
          card.appendChild(field("Author", author));
        }
      }
      var save = el("button", "primary", "Save"); save.style.marginTop = "10px";
      save.onclick = function () {
        busy(save, function () {
          var patch = {}, chain = Promise.resolve();
          if (text) patch.summary = text.value.trim();
          if (author) patch.title = author.value.trim();
          if (link) patch.meta_json = Object.assign({}, row && row.meta_json, { link: link.value.trim() });
          if (file && file.files[0]) {
            chain = upload(file.files[0], "photo").then(function (id) { patch.banner_media_id = id; });
          }
          return chain.then(function () {
            var existing = H.contents[f.key];
            var call = existing
              ? api(ROUTES.content(existing.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })
              : api(ROUTES.contentNew, { method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(Object.assign({ region: REGION, content_key: f.key, title: f.label, record_status: "published" }, patch)) });
            return call.then(function (res) {
              H.contents[f.key] = Object.assign({}, existing || {}, patch, res || {});
              if (patch.banner_media_id) prev.src = mediaUrl(patch.banner_media_id);
            });
          });
        });
      };
      card.appendChild(save);
      main.appendChild(card);
    });
  }

  /* ---------- Film halls tab ---------- */
  function lines(v) { return (Array.isArray(v) ? v : v ? [v] : []).join("\n"); }
  function unlines(s) {
    var a = s.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
    return a.length > 1 ? a : a[0] || null;
  }
  function hallsTab(main) {
    main.appendChild(el("p", "muted", "Tap Edit on a hall to change its page: name, photo, now-showing film, ticket link, call/WhatsApp numbers, gallery and social links."));
    (H.theatres || []).forEach(function (t) {
      var id = t.theatre_id || t.id;
      var card = el("div", "card"), top = el("div", "row");
      top.appendChild(thumb(t.photo_media_id));
      var info = el("div"); info.style.flex = "1";
      info.appendChild(el("h2", null, t.name || id));
      info.appendChild(el("p", "muted", [id, t.district].filter(Boolean).join(" · ")));
      var edit = el("button", null, "Edit"); top.appendChild(info); top.appendChild(edit);
      card.appendChild(top);
      var body = el("div"); body.hidden = true; card.appendChild(body);
      edit.onclick = function () {
        body.hidden = !body.hidden;
        if (!body.hidden && !body.firstChild) hallForm(body, t, id);
      };
      main.appendChild(card);
    });
    if (!(H.theatres || []).length) main.appendChild(el("p", "muted", "No film halls published yet."));
  }
  function hallForm(body, t, id) {
    var meta = Object.assign({}, t.meta_json), soc = Object.assign({}, t.social_json || {});
    var name = input(t.name), owner = input(t.owner_name), dist = input(t.district), addr = input(t.address);
    var film = input(t.current_film_title), tick = input(t.ticket_generator_url, "url");
    var phone = input(plain(meta.phone)), wa = input(plain(meta.whatsapp));
    var s = { facebook: area(lines(soc.facebook || meta.facebook)), instagram: area(lines(soc.instagram || meta.instagram)), youtube: area(lines(soc.youtube || meta.youtube)) };
    var photo = fileInput(false), poster = fileInput(false), gallery = fileInput(true);
    body.appendChild(el("hr", "sep"));
    [["Film hall name", name], ["Owner name", owner], ["District", dist], ["Address", addr],
     ["Now showing (film title)", film], ["Ticket link", tick], ["Call number", phone], ["WhatsApp number", wa]]
      .forEach(function (p) { body.appendChild(field(p[0], p[1])); });
    body.appendChild(field("Hall photo", (function () { var r = el("div", "row"); r.appendChild(thumb(t.photo_media_id)); r.appendChild(photo); return r; })()));
    body.appendChild(field("Now-showing poster", (function () { var r = el("div", "row"); r.appendChild(thumb(t.current_film_media_id)); r.appendChild(poster); return r; })()));
    var gal = el("div", "gal");
    body.appendChild(field("Gallery photos (add more)", gallery)); body.appendChild(gal);
    getJSON(ORIGIN + "/cms/public/" + enc(REGION) + "/theatres/" + enc(id))
      .catch(function () { return getJSON(DATA + "/theatre/" + enc(id) + ".json"); })
      .then(function (p) { ((p && p.gallery && p.gallery.items) || []).forEach(function (g) { gal.appendChild(thumb(g.id)); }); })
      .catch(function () {});
    body.appendChild(el("p", "muted", "Social links: one per line. A post link shows as an embed on the hall page."));
    body.appendChild(field("Facebook", s.facebook)); body.appendChild(field("Instagram", s.instagram)); body.appendChild(field("YouTube", s.youtube));
    var save = el("button", "primary", "Save this hall"); save.style.marginTop = "12px";
    save.onclick = function () {
      busy(save, function () {
        var patch = { name: name.value.trim(), owner_name: owner.value.trim(), district: dist.value.trim(), address: addr.value.trim(),
                      current_film_title: film.value.trim(), ticket_generator_url: tick.value.trim() || null };
        var chain = Promise.resolve();
        if (photo.files[0]) chain = chain.then(function () { return upload(photo.files[0], "photo", id).then(function (m) { patch.photo_media_id = m; }); });
        if (poster.files[0]) chain = chain.then(function () { return upload(poster.files[0], "photo", id).then(function (m) { patch.current_film_media_id = m; }); });
        Array.prototype.slice.call(gallery.files).forEach(function (f) { chain = chain.then(function () { return upload(f, "photo", id); }); });
        return chain.then(function () {
          var m2 = Object.assign({}, meta), s2 = Object.assign({}, soc);
          [["phone", phone.value], ["whatsapp", wa.value]].forEach(function (p) { if (p[1].trim()) m2[p[0]] = p[1].trim(); else delete m2[p[0]]; });
          ["facebook", "instagram", "youtube"].forEach(function (k) { var v = unlines(s[k].value); if (v) s2[k] = v; else delete s2[k]; delete m2[k]; });
          patch.meta_json = m2; patch.social_json = s2;
          return api(ROUTES.theatre(id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
        }).then(function () { Object.assign(t, patch); });
      });
    };
    body.appendChild(save);
  }

  /* ---------- Social links tab ---------- */
  function socialTab(main) {
    main.appendChild(el("p", "muted", "The Follow Us buttons at the bottom of the home page."));
    var list = (H.links || []).slice();
    list.push({ _new: true, title: "", url: "" });
    list.forEach(function (l) {
      var card = el("div", "card");
      var title = input(l.title), url = input(l.url, "url");
      card.appendChild(el("h2", null, l._new ? "Add a link" : l.title || "Link"));
      card.appendChild(field("Button name (Facebook, YouTube, Instagram…)", title)); card.appendChild(field("Link", url));
      var row = el("div", "row"); row.style.marginTop = "10px";
      var save = el("button", "primary", l._new ? "Add" : "Save");
      save.onclick = function () {
        busy(save, function () {
          var patch = { title: title.value.trim(), url: url.value.trim() };
          var call = l._new
            ? api(ROUTES.linkNew, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ region: REGION, record_status: "published" }, patch)) })
            : api(ROUTES.link(l.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
          return call.then(function (res) { if (l._new) { H.links.push(Object.assign({}, patch, res || {})); render(); } else Object.assign(l, patch); });
        });
      };
      row.appendChild(save);
      if (!l._new) {
        var del = el("button", "danger", "Delete");
        del.onclick = function () {
          if (!confirm("Delete this link?")) return;
          busy(del, function () { return api(ROUTES.link(l.id), { method: "DELETE" }).then(function () { H.links = H.links.filter(function (x) { return x !== l; }); render(); }); });
        };
        row.appendChild(del);
      }
      card.appendChild(row); main.appendChild(card);
    });
  }

  /* ---------- Other sections (view only for now) ---------- */
  function moreTab(main) {
    var cats = {};
    (H.categories || []).forEach(function (c) { cats[c.id] = c.label; });
    var groups = [
      ["Community categories", H.categories, function (c) { return c.label; }],
      ["Community members", H.community, function (m) { return [m.name, cats[m.category_id]].filter(Boolean).join(" · "); }],
      ["Activities", H.activities, function (a) { return a.title; }],
      ["Documents", H.documents, function (d) { return d.title; }]
    ];
    main.appendChild(el("p", "muted", "These sections are shown here as they are published. Editing them needs their save routes added to admin.js."));
    groups.forEach(function (g) {
      var card = el("div", "card"); card.appendChild(el("h2", null, g[0] + " (" + (g[1] || []).length + ")"));
      (g[1] || []).forEach(function (r) { card.appendChild(el("p", "muted", g[2](r) || "(no name)")); });
      main.appendChild(card);
    });
  }

  if (sessionStorage.getItem(TOKEN_KEY)) start().catch(function () { showLogin(); });
  else showLogin();
})();
