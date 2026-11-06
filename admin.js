/* FilmHall Odisha admin (version 2).
   Everything is saved straight into this GitHub repo in ONE commit per save,
   so there is no CMS, tunnel or publish script. GitHub Pages then updates the site in about a minute.
   Login = a GitHub token limited to this one repo (entered here, never stored in the repo). */
(function () {
  "use strict";

  var OWNER = "Prabhash1234-bit", REPO = "odisha-filmhall-website", BRANCH = "main";
  var REGION = "odisha", DATA = "data/odisha";
  var API = "https://api.github.com/repos/" + OWNER + "/" + REPO;
  var TOKEN_KEY = "fh_gh_token", MAX_GALLERY = 4;
  /* Address of the owner service (Cloudflare Worker). It is set once in config.js:
     window.FILMHALL_OWNER_API = "https://filmhall-owners.yourname.workers.dev"; */
  var OWNER_API = String(window.FILMHALL_OWNER_API || "").replace(/\/+$/, "");
  var OWNER_TOKEN_KEY = "fh_owner_token";
  var ADMIN_KEY_STORE = "fh_owner_admin_key";
  var enc = encodeURIComponent;

  var HOME_FIELDS = [
    { key: "site.title", label: "Site title", kind: "text" },
    { key: "site.tagline", label: "Tagline", kind: "area" },
    { key: "site.intro", label: "Intro paragraph", kind: "area" },
    { key: "site.logo", label: "Logo", kind: "image", png: true },
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
  var HOME = null, DEFAULTS = {}, tab = "halls";

  /* ---------- small helpers ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }
  function toast(msg, isErr) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.className = isErr ? "err" : ""; t.style.display = "block";
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.style.display = "none"; }, isErr ? 6000 : 4500);
  }
  function field(label, node) { var w = el("div"); w.appendChild(el("label", null, label)); w.appendChild(node); return w; }
  function input(v, type) { var i = el("input"); i.type = type || "text"; i.value = v || ""; return i; }
  function area(v) { var a = el("textarea"); a.value = v || ""; return a; }
  function fileInput(accept) { var f = el("input"); f.type = "file"; f.accept = accept || "image/*"; return f; }
  function plain(v) {
    if (v == null) return "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "object" && typeof v.text === "string") return v.text.trim();
    return "";
  }
  function stripQ(p) { return String(p || "").split("?")[0]; }
  function mediaPath(id, extra) { return (extra && extra[id]) || (HOME && HOME.media && HOME.media[id]) || ""; }
  function thumb(path, w, h) {
    var i = el("img", "thumb"); i.alt = "";
    if (path) i.src = path;
    if (w) { i.style.width = w + "px"; i.style.height = h + "px"; }
    return i;
  }
  function busy(btn, work) {
    btn.disabled = true;
    return Promise.resolve().then(work)
      .then(function (msg) { toast(msg || "Published. The website updates in about a minute."); },
            function (e) { if (e.message !== "Token rejected" && e.message !== "Session ended") toast(e.message, true); })
      .then(function () { btn.disabled = false; });
  }
  function part(body, title, hint) {
    var p = el("div"); p.style.cssText = "border-top:1px solid var(--line);margin-top:18px;padding-top:6px";
    var h = el("h3", null, title); h.style.cssText = "margin:8px 0 2px;font-size:16px";
    p.appendChild(h);
    if (hint) p.appendChild(el("p", "muted", hint));
    body.appendChild(p); return p;
  }

  /* ---------- GitHub access ---------- */
  function token() { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ""; }
  function hdrs(extra) {
    return Object.assign({ Authorization: "Bearer " + token(), "X-GitHub-Api-Version": "2022-11-28" }, extra || {});
  }
  function gh(path, opt) {
    opt = opt || {};
    var h = hdrs({ Accept: "application/vnd.github+json" });
    if (opt.body) h["Content-Type"] = "application/json";
    return fetch(API + path, { method: opt.method || "GET", headers: h, body: opt.body, cache: "no-store" })
      .catch(function () { throw new Error("Cannot reach GitHub. Check your internet connection."); })
      .then(function (r) {
        if (r.status === 401) { logout("This GitHub token is not valid or has expired. Please log in again."); throw new Error("Token rejected"); }
        return r.text().then(function (b) {
          var d = null; try { d = b ? JSON.parse(b) : null; } catch (e) { d = null; }
          if (!r.ok) {
            if (r.status === 403 || r.status === 404) throw new Error("GitHub says (" + r.status + "): " + ((d && d.message) || "refused") + " — the token needs Contents: Read and write on this repo.");
            if (r.status === 422) throw new Error("GitHub changed while saving. Reload the page and try again.");
            throw new Error((d && d.message) || "GitHub error " + r.status);
          }
          return d;
        });
      });
  }
  function readText(path) {
    return fetch(API + "/contents/" + path.split("/").map(enc).join("/") + "?ref=" + BRANCH,
      { headers: hdrs({ Accept: "application/vnd.github.raw+json" }), cache: "no-store" })
      .catch(function () { throw new Error("Cannot reach GitHub. Check your internet connection."); })
      .then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error("Could not read " + path + " (HTTP " + r.status + ")");
        return r.text();
      });
  }
  /* One commit for any number of files: files = [{path, text | b64}], deletes = [path] */
  function commit(files, deletes, message) {
    var head, base;
    return gh("/git/ref/heads/" + BRANCH).then(function (r) { head = r.object.sha; return gh("/git/commits/" + head); })
      .then(function (c) {
        base = c.tree.sha;
        return Promise.all(files.map(function (f) {
          var body = f.b64 != null ? { content: f.b64, encoding: "base64" } : { content: f.text, encoding: "utf-8" };
          return gh("/git/blobs", { method: "POST", body: JSON.stringify(body) })
            .then(function (b) { return { path: f.path, mode: "100644", type: "blob", sha: b.sha }; });
        }));
      })
      .then(function (entries) {
        deletes.forEach(function (p) { entries.push({ path: p, mode: "100644", type: "blob", sha: null }); });
        return gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: base, tree: entries }) });
      })
      .then(function (t) { return gh("/git/commits", { method: "POST", body: JSON.stringify({ message: message, tree: t.sha, parents: [head] }) }); })
      .then(function (c) { return gh("/git/refs/heads/" + BRANCH, { method: "PATCH", body: JSON.stringify({ sha: c.sha }) }); });
  }
  /* Re-read home.json right before saving so nothing newer is overwritten. */
  function freshHome() {
    return readText(DATA + "/home.json").then(function (t) {
      if (!t) throw new Error("data/odisha/home.json was not found in the repo.");
      var H = JSON.parse(t);
      H.contents = H.contents || {}; H.theatres = H.theatres || []; H.links = H.links || []; H.media = H.media || {};
      return H;
    });
  }
  function homeFile(H) { return { path: DATA + "/home.json", text: JSON.stringify(H, null, 2) + "\n" }; }

  /* ---------- photos: resized in the browser, kept sharp ---------- */
  function prep(file, max, quality, png) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        var x = c.getContext("2d");
        if (!png) { x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); }
        x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          URL.revokeObjectURL(url);
          if (!b) return reject(new Error("Could not process that photo."));
          var fr = new FileReader();
          fr.onload = function () { resolve({ b64: String(fr.result).split(",")[1], ext: png ? "png" : "jpg" }); };
          fr.readAsDataURL(b);
        }, png ? "image/png" : "image/jpeg", quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("That file is not a photo I can read.")); };
      img.src = url;
    });
  }
  function picker(path, hint) {
    var wrap = el("div", "row"), prev = thumb(path, 140, 100), inp = fileInput();
    var note = el("p", "muted"); note.style.width = "100%";
    inp.onchange = function () {
      var f = inp.files[0]; if (!f) return;
      var u = URL.createObjectURL(f); prev.src = u; note.textContent = "";
      var probe = new Image();
      probe.onload = function () { if (hint && probe.naturalWidth < hint) note.textContent = "This photo is small (" + probe.naturalWidth + " px wide). It may look blurry; use a bigger one if you can."; };
      probe.src = u;
    };
    wrap.appendChild(prev); wrap.appendChild(inp); wrap.appendChild(note);
    return { node: wrap, input: inp };
  }

  /* ---------- login ---------- */
  function logout(msg) {
    sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY);
    showChooser(msg);
  }
  function showLogin(msg) {
    app.replaceChildren();
    var box = el("div"); box.id = "login";
    var card = el("div", "card");
    card.appendChild(el("h2", null, "FilmHall Odisha admin"));
    card.appendChild(el("p", "muted", msg || "Paste your GitHub token for this website to log in."));
    var t = input("", "password"); t.autocomplete = "off"; t.placeholder = "github_pat_...";
    var rem = el("input"); rem.type = "checkbox";
    var remLab = el("label"); remLab.style.cssText = "display:flex;gap:8px;align-items:center;margin:12px 0"; remLab.appendChild(rem); remLab.appendChild(document.createTextNode("Keep me logged in on this device"));
    var b = el("button", "primary", "Log in");
    function go() {
      busy(b, function () {
        var v = t.value.trim();
        if (!v) throw new Error("Paste your token first.");
        (rem.checked ? localStorage : sessionStorage).setItem(TOKEN_KEY, v);
        return gh("").then(function (r) {
          if (r.permissions && r.permissions.push === false) throw new Error("This token can read the repo but cannot write to it.");
          return start();
        }).then(function () { return "Logged in"; }, function (e) { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); throw e; });
      });
    }
    b.onclick = go; t.onkeydown = function (e) { if (e.key === "Enter") go(); };
    card.appendChild(field("GitHub token", t)); card.appendChild(remLab); card.appendChild(b);
    var back = el("a", "muted", "Back to the website"); back.href = "index.html"; back.style.cssText = "display:block;margin-top:12px";
    var other = el("button", null, "\u2190 Back"); other.style.marginTop = "12px"; other.onclick = function () { showChooser(); };
    card.appendChild(other); card.appendChild(back); box.appendChild(card); app.appendChild(box);
  }

  /* ---------- load + shell ---------- */
  function loadDefaults() {
    return fetch("index.html", { cache: "no-cache" }).then(function (r) { return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("[data-cms]").forEach(function (n) { DEFAULTS[n.getAttribute("data-cms")] = n.textContent.trim(); });
    }).catch(function () {});
  }
  function start() {
    return Promise.all([freshHome(), loadDefaults()]).then(function (r) { HOME = r[0]; render(); });
  }
  function render() {
    app.replaceChildren();
    var head = el("header"), bar = el("div", "bar");
    var logo = el("img"); logo.src = "logo.png"; logo.alt = "";
    var out = el("button", null, "Log out"); out.onclick = function () { logout("You are logged out."); };
    bar.appendChild(logo); bar.appendChild(el("h1", null, "Website admin")); bar.appendChild(out);
    var tabs = el("div", "tabs");
    [["halls", "Film halls"], ["home", "Home page"], ["social", "Social links"], ["owners", "Hall owners"]].forEach(function (t) {
      var b = el("button", tab === t[0] ? "on" : "", t[1]);
      b.onclick = function () { tab = t[0]; render(); };
      tabs.appendChild(b);
    });
    head.appendChild(bar); head.appendChild(tabs);
    var main = el("main");
    ({ halls: hallsTab, home: homeTab, social: socialTab, owners: ownersTab })[tab](main);
    app.appendChild(head); app.appendChild(main);
  }

  /* ---------- Film halls ---------- */
  function lines(v) { return (Array.isArray(v) ? v : v ? [v] : []).join("\n"); }
  function unlines(s) {
    var a = s.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
    return a.length > 1 ? a : a[0] || null;
  }
  function nextHallId() {
    var max = 0;
    HOME.theatres.forEach(function (t) { var m = /(\d+)\s*$/.exec(String(t.theatre_id || t.id || "")); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    return "FH-THR-OD-" + String(max + 1).padStart(3, "0");
  }
  function hallsTab(main) {
    var add = el("button", "primary", "+ Add new film hall"); add.style.marginBottom = "14px";
    var slot = el("div");
    add.onclick = function () {
      if (slot.firstChild) { slot.replaceChildren(); return; }
      var card = el("div", "card"), body = el("div");
      card.appendChild(el("h2", null, "New film hall"));
      card.appendChild(el("p", "muted", "Fill the parts below in the same order as the public hall page."));
      card.appendChild(body); slot.appendChild(card);
      hallForm(body, null, null);
    };
    main.appendChild(add); main.appendChild(slot);
    HOME.theatres.forEach(function (t) {
      var id = t.theatre_id || t.id;
      var card = el("div", "card"), top = el("div", "row");
      top.appendChild(thumb(mediaPath(t.photo_media_id)));
      var info = el("div"); info.style.flex = "1";
      info.appendChild(el("h2", null, t.name || id));
      info.appendChild(el("p", "muted", [id, t.district].filter(Boolean).join(" · ")));
      var edit = el("button", null, "Edit"), view = el("a", "muted", "View page");
      view.href = "theatre.html?id=" + enc(id); view.target = "_blank"; view.rel = "noopener";
      top.appendChild(info); top.appendChild(view); top.appendChild(edit); card.appendChild(top);
      var body = el("div"); body.hidden = true; card.appendChild(body);
      edit.onclick = function () {
        body.hidden = !body.hidden;
        if (body.hidden || body.firstChild) return;
        body.appendChild(el("p", "muted", "Loading…"));
        readText(DATA + "/theatre/" + enc(id) + ".json").then(function (txt) {
          body.replaceChildren();
          var hj = null; try { hj = txt ? JSON.parse(txt) : null; } catch (e) { hj = null; }
          hallForm(body, t, hj);
        }).catch(function (e) { body.replaceChildren(); toast(e.message, true); });
      };
      main.appendChild(card);
    });
    if (!HOME.theatres.length) main.appendChild(el("p", "muted", "No film halls yet."));
  }

  /* The form follows the public hall page: photo, details, Book ticket, poster, gallery (4 max), Join with us. */
  function hallForm(body, row, hj) {
    var isNew = !row, r = row || {};
    var meta = Object.assign({}, r.meta_json), soc = Object.assign({}, r.social_json || {});
    var hallMedia = (hj && hj.media) || {};
    var p;

    p = part(body, "Theatre photo", "The big photo at the top of the hall page.");
    var photo = picker(mediaPath(r.photo_media_id, hallMedia), 600); p.appendChild(photo.node);

    p = part(body, "Hall details");
    var idIn = isNew ? input(nextHallId()) : null;
    var name = input(r.name), owner = input(r.owner_name), dist = input(r.district), addr = input(r.address);
    if (idIn) p.appendChild(field("Hall ID (filled in automatically)", idIn));
    p.appendChild(field("Film hall name", name)); p.appendChild(field("Owner name", owner));
    p.appendChild(field("District", dist)); p.appendChild(field("Address", addr));

    p = part(body, "Book ticket", "Numbers for the Call and WhatsApp buttons.");
    var phone = input(plain(meta.phone)), wa = input(plain(meta.whatsapp)), tick = input(r.ticket_generator_url, "url");
    p.appendChild(field("Call number", phone)); p.appendChild(field("WhatsApp number", wa));
    p.appendChild(field("Online ticket link (optional)", tick));

    p = part(body, "Film poster", "Use a tall poster, at least 800 px wide. It is saved sharp (up to 1800 px) and is never cropped.");
    var film = input(r.current_film_title), poster = picker(mediaPath(r.current_film_media_id, hallMedia), 800);
    p.appendChild(field("Film name", film)); p.appendChild(poster.node);

    p = part(body, "Gallery", "Up to " + MAX_GALLERY + " photos. Replace or remove any of them whenever you like.");
    var items = (hj && hj.gallery && hj.gallery.items) || [];
    var slots = [];
    for (var i = 0; i < MAX_GALLERY; i++) (function (i) {
      var s = { id: items[i] ? items[i].id : null, file: null, removed: false };
      slots.push(s);
      var row2 = el("div", "row"); row2.style.marginTop = "8px";
      var prev = thumb(s.id ? mediaPath(s.id, hallMedia) : "", 96, 72), inp = fileInput();
      var rm = el("button", "danger", "Remove");
      inp.onchange = function () { if (inp.files[0]) { s.file = inp.files[0]; s.removed = false; prev.src = URL.createObjectURL(inp.files[0]); } };
      rm.onclick = function () { s.file = null; s.removed = true; inp.value = ""; prev.removeAttribute("src"); };
      row2.appendChild(el("b", null, "Photo " + (i + 1))); row2.appendChild(prev); row2.appendChild(inp); row2.appendChild(rm);
      p.appendChild(row2);
    })(i);

    p = part(body, "Join with us", "Facebook, YouTube and Instagram buttons. If you add more than one link, the first one is used.");
    var s = { facebook: area(lines(soc.facebook || meta.facebook)), youtube: area(lines(soc.youtube || meta.youtube)), instagram: area(lines(soc.instagram || meta.instagram)) };
    Object.keys(s).forEach(function (k) { s[k].style.minHeight = "48px"; });
    p.appendChild(field("Facebook (F)", s.facebook)); p.appendChild(field("YouTube (Y)", s.youtube)); p.appendChild(field("Instagram (I)", s.instagram));

    var save = el("button", "primary", isNew ? "Create film hall" : "Save this hall"); save.style.marginTop = "18px";
    save.onclick = function () {
      busy(save, function () {
        var tid = idIn ? idIn.value.trim() : r.theatre_id;
        if (isNew) {
          if (!/^[A-Za-z0-9_-]{3,40}$/.test(tid)) throw new Error("Hall ID can use letters, numbers, - and _ only.");
          if (HOME.theatres.some(function (t) { return (t.theatre_id || t.id) === tid; })) throw new Error("A hall with this ID already exists.");
        }
        if (!name.value.trim()) throw new Error("Please enter the film hall name.");

        var stamp = Date.now(), dir = "media/theatres/" + tid + "/", files = [], deletes = [], media = {}, upd = {};
        function addImage(file, nameBase, max, q, role) {
          return prep(file, max, q, false).then(function (img) {
            var id = "adm_" + tid + "_" + role, path = dir + nameBase + "." + img.ext;
            files.push({ path: path, b64: img.b64 }); media[id] = path + "?v=" + stamp; return id;
          });
        }
        var jobs = [];
        if (photo.input.files[0]) jobs.push(addImage(photo.input.files[0], "photo", 1600, 0.9, "photo").then(function (id) { upd.photo_media_id = id; }));
        if (poster.input.files[0]) jobs.push(addImage(poster.input.files[0], "poster", 1800, 0.93, "poster").then(function (id) { upd.current_film_media_id = id; }));
        slots.forEach(function (s, i) {
          if (s.file) jobs.push(addImage(s.file, "gallery-" + (i + 1), 1400, 0.88, "g" + (i + 1)).then(function (id) { s.newId = id; }));
          else if (s.removed && s.id) { var old = stripQ(mediaPath(s.id, hallMedia)); if (old.indexOf(dir) === 0) deletes.push(old); }
        });

        return Promise.all(jobs).then(function () {
          var m2 = Object.assign({}, meta), s2 = Object.assign({}, soc);
          [["phone", phone.value], ["whatsapp", wa.value]].forEach(function (q) { if (q[1].trim()) m2[q[0]] = q[1].trim(); else delete m2[q[0]]; });
          ["facebook", "instagram", "youtube"].forEach(function (k) { var v = unlines(s[k].value); if (v) s2[k] = v; else delete s2[k]; delete m2[k]; });
          var now = new Date().toISOString();
          var base = isNew ? { theatre_id: tid, id: tid, region: REGION, status: "active", photo_media_id: null, current_film_media_id: null,
                               record_status: "published", published_at: now, created_at: now, rev: 0, prices_json: [], payment_qr_media_id: null, owner_user_id: null }
                           : r;
          var rowOut = Object.assign({}, base, upd, {
            name: name.value.trim(), owner_name: owner.value.trim(), district: dist.value.trim(), address: addr.value.trim(),
            current_film_title: film.value.trim() || null, ticket_generator_url: tick.value.trim() || null,
            meta_json: m2, social_json: s2, updated_at: now, rev: (base.rev || 0) + 1
          });
          var gal = [];
          slots.forEach(function (s) { var id = s.newId || (!s.removed && s.id); if (id) gal.push({ id: id, alt_text: rowOut.name + " photo" }); });
          var hallMediaOut = {};
          [rowOut.photo_media_id, rowOut.current_film_media_id].concat(gal.map(function (g) { return g.id; })).forEach(function (id) {
            if (id) hallMediaOut[id] = media[id] || mediaPath(id, hallMedia);
          });
          var hallJson = Object.assign({}, rowOut, { gallery: { items: gal }, media: hallMediaOut });
          files.push({ path: DATA + "/theatre/" + tid + ".json", text: JSON.stringify(hallJson, null, 2) + "\n" });

          return freshHome().then(function (H) {
            Object.assign(H.media, media);
            [rowOut.photo_media_id, rowOut.current_film_media_id].forEach(function (id) { if (id && !H.media[id] && hallMediaOut[id]) H.media[id] = hallMediaOut[id]; });
            var at = -1; H.theatres.forEach(function (t, i) { if ((t.theatre_id || t.id) === tid) at = i; });
            if (at >= 0) H.theatres[at] = rowOut; else H.theatres.push(rowOut);
            files.push(homeFile(H));
            return commit(files, deletes, "Admin: " + (isNew ? "add" : "update") + " hall " + tid).then(function () { HOME = H; render(); });
          });
        });
      });
    };
    body.appendChild(save);
  }

  /* ---------- Home page texts, logo and banner ---------- */
  function homeTab(main) {
    main.appendChild(el("p", "muted", "Boxes start with the wording the website shows now. Clear a box and save to go back to the built-in wording."));
    HOME_FIELDS.forEach(function (f) {
      var row = HOME.contents[f.key] || null;
      var card = el("div", "card");
      card.appendChild(el("h2", null, f.label)); card.appendChild(el("p", "muted", f.key));
      var current = f.author ? plain(row && (row.summary || row.body_json))
                             : (plain(row && (row.summary || row.title || row.body_json)) || DEFAULTS[f.key] || "");
      var text = null, author = null, link = null, pick = null;
      if (f.kind === "image") {
        pick = picker(row && row.banner_media_id ? mediaPath(row.banner_media_id) : "", f.png ? 0 : 1000);
        card.appendChild(pick.node);
        if (f.link) { link = input(row && row.meta_json && (row.meta_json.link || row.meta_json.url), "url"); card.appendChild(field("Link when the photo is clicked", link)); }
      } else {
        text = f.kind === "area" ? area(current) : input(current); card.appendChild(text);
        if (f.author) { author = input(row && (row.title || (row.meta_json && row.meta_json.author))); card.appendChild(field("Author", author)); }
      }
      var save = el("button", "primary", "Save"); save.style.marginTop = "10px";
      save.onclick = function () {
        busy(save, function () {
          var files = [], media = {}, stamp = Date.now();
          var job = Promise.resolve(null);
          if (pick && pick.input.files[0]) {
            job = prep(pick.input.files[0], f.png ? 1200 : 1800, 0.92, !!f.png).then(function (img) {
              var id = "adm_" + f.key.replace(/\./g, "_"), path = "media/site/" + f.key.replace(/\./g, "-") + "." + img.ext;
              files.push({ path: path, b64: img.b64 }); media[id] = path + "?v=" + stamp; return id;
            });
          }
          return job.then(function (newMedia) {
            return freshHome().then(function (H) {
              var cur = H.contents[f.key] || null, now = new Date().toISOString();
              var out = Object.assign({ id: "cnt_adm_" + f.key.replace(/\./g, "_"), region: REGION, content_key: f.key, title: f.label, summary: null,
                                        body_json: null, banner_media_id: null, record_status: "published", published_at: now, created_at: now,
                                        owner_theatre_id: null, rev: 0, meta_json: null }, cur || {});
              if (text) {
                var v = text.value.trim();
                if (!v && !f.author) { delete H.contents[f.key]; out = null; }
                else { out.summary = v || null; out.title = f.author ? (author.value.trim() || out.title) : v; }
              }
              if (out) {
                if (newMedia) out.banner_media_id = newMedia;
                if (link) out.meta_json = Object.assign({}, out.meta_json, { link: link.value.trim() });
                out.updated_at = now; out.rev = (out.rev || 0) + 1; H.contents[f.key] = out;
              }
              Object.assign(H.media, media);
              files.push(homeFile(H));
              return commit(files, [], "Admin: update " + f.key).then(function () { HOME = H; render(); });
            });
          });
        });
      };
      card.appendChild(save); main.appendChild(card);
    });
  }

  /* ---------- Social links (Follow Us buttons on the home page) ---------- */
  function socialTab(main) {
    main.appendChild(el("p", "muted", "The Follow Us buttons on the home page. Once you add any link here, these replace the built-in buttons, so add all that you want to show."));
    var list = HOME.links.slice(); list.push({ _new: true, title: "", url: "" });
    list.forEach(function (l) {
      var card = el("div", "card"), title = input(l.title), url = input(l.url, "url");
      card.appendChild(el("h2", null, l._new ? "Add a link" : l.title || "Link"));
      card.appendChild(field("Button name (Facebook, YouTube, Instagram…)", title)); card.appendChild(field("Link", url));
      var row = el("div", "row"); row.style.marginTop = "10px";
      function change(mutate, msg) {
        return freshHome().then(function (H) { mutate(H); return commit([homeFile(H)], [], msg).then(function () { HOME = H; render(); }); });
      }
      var save = el("button", "primary", l._new ? "Add" : "Save");
      save.onclick = function () {
        busy(save, function () {
          var t = title.value.trim(), u = url.value.trim();
          if (!t || !u) throw new Error("Please fill in the button name and the link.");
          return change(function (H) {
            if (l._new) H.links.push({ id: "lnk_adm_" + Date.now(), region: REGION, title: t, url: u, sort_order: H.links.length + 1 });
            else H.links.forEach(function (x) { if (x.id === l.id) { x.title = t; x.url = u; } });
          }, "Admin: social link " + t);
        });
      };
      row.appendChild(save);
      if (!l._new) {
        var del = el("button", "danger", "Delete");
        del.onclick = function () {
          if (!confirm("Delete this link?")) return;
          busy(del, function () { return change(function (H) { H.links = H.links.filter(function (x) { return x.id !== l.id; }); }, "Admin: delete social link"); });
        };
        row.appendChild(del);
      }
      card.appendChild(row); main.appendChild(card);
    });
  }


  /* ---------- Hall owners (logins for the owner app) ---------- */
  function oapi(path, method, body) {
    return fetch(OWNER_API.replace(/\/+$/, "") + path, {
      method: method || "GET",
      headers: Object.assign({ "X-Admin-Key": sessionStorage.getItem(ADMIN_KEY_STORE) || "" }, body ? { "Content-Type": "application/json" } : {}),
      body: body ? JSON.stringify(body) : undefined
    }).catch(function () { throw new Error("Cannot reach the owner service. Check the address in OWNER_API."); })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (r.status === 401) sessionStorage.removeItem(ADMIN_KEY_STORE);
          if (!r.ok) throw new Error(d.error || "Error " + r.status);
          return d;
        });
      });
  }
  function randomPassword() {
    var chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789", a = new Uint32Array(10), out = "";
    crypto.getRandomValues(a);
    for (var i = 0; i < a.length; i++) out += chars[a[i] % chars.length];
    return out;
  }
  function showCreds(box, username, password) {
    box.replaceChildren();
    var c = el("div", "card"); c.style.borderColor = "var(--accent)";
    c.appendChild(el("h2", null, "Give this login to the owner"));
    c.appendChild(el("p", "muted", "The password is shown only now. Copy it before you leave this page."));
    var t = el("p", null, "Username: " + username + "\nPassword: " + password); t.style.cssText = "white-space:pre;font-family:monospace;font-size:17px;margin:8px 0";
    var cp = el("button", "primary", "Copy");
    cp.onclick = function () {
      (navigator.clipboard ? navigator.clipboard.writeText("Username: " + username + "\nPassword: " + password) : Promise.reject())
        .then(function () { toast("Copied"); }, function () { toast("Copy it by hand from the screen.", true); });
    };
    c.appendChild(t); c.appendChild(cp); box.appendChild(c);
  }
  function hallName(id) {
    var n = id; HOME.theatres.forEach(function (t) { if ((t.theatre_id || t.id) === id) n = t.name || id; });
    return n;
  }
  function ownersTab(main) {
    var card = el("div", "card");
    if (!OWNER_API) {
      card.appendChild(el("h2", null, "Hall owners"));
      card.appendChild(el("p", "muted", "Not set up yet. After you deploy the owner service, paste its address into OWNER_API at the top of admin.js."));
      main.appendChild(card); return;
    }
    if (!sessionStorage.getItem(ADMIN_KEY_STORE)) {
      card.appendChild(el("h2", null, "Owner admin key"));
      card.appendChild(el("p", "muted", "Enter the ADMIN_KEY you saved when you set up the owner service."));
      var k = input("", "password"), b = el("button", "primary", "Connect"); b.style.marginTop = "10px";
      b.onclick = function () {
        busy(b, function () {
          sessionStorage.setItem(ADMIN_KEY_STORE, k.value.trim());
          return oapi("/admin/owners").then(function () { render(); return "Connected"; }, function (e) { sessionStorage.removeItem(ADMIN_KEY_STORE); throw e; });
        });
      };
      card.appendChild(k); card.appendChild(b); main.appendChild(card); return;
    }

    var credsBox = el("div"), list = el("div");
    var create = el("div", "card");
    create.appendChild(el("h2", null, "Create owner login"));
    create.appendChild(el("p", "muted", "The owner can only change photos of this one hall: hall photo, film poster and up to 4 gallery photos."));
    var hall = el("select");
    HOME.theatres.forEach(function (t) { var o = el("option", null, (t.name || t.theatre_id) + " (" + (t.theatre_id || t.id) + ")"); o.value = t.theatre_id || t.id; hall.appendChild(o); });
    var user = input(""), pass = input(randomPassword());
    user.placeholder = "for example: sundarghar (no spaces)";
    var gen = el("button", null, "New random password"); gen.onclick = function () { pass.value = randomPassword(); };
    var make = el("button", "primary", "Create login"); make.style.marginLeft = "8px";
    make.onclick = function () {
      busy(make, function () {
        var u = user.value.trim().toLowerCase(), p = pass.value;
        return oapi("/admin/owners", "POST", { username: u, theatre_id: hall.value, password: p }).then(function () {
          showCreds(credsBox, u, p); user.value = ""; pass.value = randomPassword(); load();
          return "Owner created. Copy the login shown above.";
        });
      });
    };
    create.appendChild(field("Film hall", hall)); create.appendChild(field("Username", user)); create.appendChild(field("Password", pass));
    var br = el("div"); br.style.marginTop = "12px"; br.appendChild(gen); br.appendChild(make); create.appendChild(br);

    function load() {
      list.replaceChildren(el("p", "muted", "Loading…"));
      oapi("/admin/owners").then(function (d) {
        list.replaceChildren();
        if (!d.owners.length) list.appendChild(el("p", "muted", "No owner logins yet."));
        d.owners.forEach(function (o) {
          var c = el("div", "card");
          c.appendChild(el("h2", null, o.username + (o.blocked ? "  (BLOCKED)" : "")));
          c.appendChild(el("p", "muted", hallName(o.theatre_id) + " · " + (o.last_login ? "last login " + new Date(o.last_login).toLocaleString() : "never logged in")));
          var row = el("div", "row");
          var blk = el("button", o.blocked ? "primary" : "danger", o.blocked ? "Unblock" : "Block");
          blk.onclick = function () {
            busy(blk, function () { return oapi("/admin/owners/" + encodeURIComponent(o.username) + "/block", "POST", { blocked: !o.blocked }).then(function () { load(); return o.blocked ? "Unblocked" : "Blocked. The owner is logged out immediately."; }); });
          };
          var rst = el("button", null, "Reset password");
          rst.onclick = function () {
            var np = randomPassword();
            busy(rst, function () { return oapi("/admin/owners/" + encodeURIComponent(o.username) + "/password", "POST", { password: np }).then(function () { showCreds(credsBox, o.username, np); window.scrollTo(0, 0); return "Password changed. Copy the new login shown above."; }); });
          };
          var del = el("button", "danger", "Delete");
          del.onclick = function () {
            if (!confirm("Delete the login " + o.username + "?")) return;
            busy(del, function () { return oapi("/admin/owners/" + encodeURIComponent(o.username), "DELETE").then(function () { load(); return "Deleted"; }); });
          };
          row.appendChild(blk); row.appendChild(rst); row.appendChild(del); c.appendChild(row); list.appendChild(c);
        });
      }).catch(function (e) { list.replaceChildren(el("p", "muted", e.message)); });
    }
    main.appendChild(credsBox); main.appendChild(create); main.appendChild(list); load();
  }


  /* ---------- first screen: HQ admin or theatre owner ---------- */
  function showChooser(msg) {
    app.replaceChildren();
    var box = el("div"); box.id = "login";
    var card = el("div", "card");
    card.appendChild(el("h2", null, "FilmHall Odisha admin"));
    card.appendChild(el("p", "muted", msg || "Who is logging in?"));
    var hq = el("button", "primary", "HQ Admin"), ow = el("button", null, "Theatre Owner");
    [hq, ow].forEach(function (b) { b.style.cssText = "display:block;width:100%;padding:16px;font-size:17px;margin-top:12px"; });
    hq.onclick = function () { showLogin(); };
    ow.onclick = function () { showOwnerLogin(); };
    card.appendChild(hq); card.appendChild(ow);
    var back = el("a", "muted", "Back to the website"); back.href = "index.html"; back.style.cssText = "display:block;margin-top:16px";
    card.appendChild(back); box.appendChild(card); app.appendChild(box);
  }

  /* ---------- theatre owner: login ---------- */
  var OWNER_HALL = null, OWNER_LOCAL = {};
  function ownerToken() { return sessionStorage.getItem(OWNER_TOKEN_KEY) || localStorage.getItem(OWNER_TOKEN_KEY) || ""; }
  function ownerLogout(msg) {
    sessionStorage.removeItem(OWNER_TOKEN_KEY); localStorage.removeItem(OWNER_TOKEN_KEY);
    OWNER_HALL = null; showChooser(msg);
  }
  function owApi(path, method, body, type) {
    return fetch(OWNER_API + path, {
      method: method || "GET",
      headers: Object.assign({ Authorization: "Bearer " + ownerToken() }, body ? { "Content-Type": type || "application/json" } : {}),
      body: body
    }).catch(function () { throw new Error("Cannot reach the server. Check your internet and try again."); })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (r.status === 401 || r.status === 403) { ownerLogout(d.error || "Please log in again."); throw new Error("Session ended"); }
          if (!r.ok) throw new Error(d.error || "Error " + r.status);
          return d;
        });
      });
  }
  function showOwnerLogin(msg) {
    app.replaceChildren();
    var box = el("div"); box.id = "login";
    var card = el("div", "card");
    card.appendChild(el("h2", null, "Theatre owner login"));
    if (!OWNER_API) {
      card.appendChild(el("p", "muted", "Owner login is not set up yet. Ask FilmHall HQ."));
      var b0 = el("button", null, "\u2190 Back"); b0.onclick = function () { showChooser(); }; card.appendChild(b0);
      box.appendChild(card); app.appendChild(box); return;
    }
    card.appendChild(el("p", "muted", msg || "Choose your theatre and enter the username and password FilmHall gave you."));
    var hall = el("select"); var first = el("option", null, "Loading theatres…"); first.value = ""; hall.appendChild(first);
    fetch(DATA + "/home.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (h) {
      hall.replaceChildren();
      var ph = el("option", null, "Select your theatre"); ph.value = ""; hall.appendChild(ph);
      (h.theatres || []).slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); }).forEach(function (t) {
        var o = el("option", null, t.name || t.theatre_id); o.value = t.theatre_id || t.id; hall.appendChild(o);
      });
    }).catch(function () { first.textContent = "Could not load the theatre list"; });
    var u = input("", "text"); u.autocomplete = "username"; u.autocapitalize = "none";
    var p = input("", "password"); p.autocomplete = "current-password";
    var rem = el("input"); rem.type = "checkbox";
    var remLab = el("label"); remLab.style.cssText = "display:flex;gap:8px;align-items:center;margin:12px 0"; remLab.appendChild(rem); remLab.appendChild(document.createTextNode("Keep me logged in on this device"));
    var b = el("button", "primary", "Log in");
    function go() {
      busy(b, function () {
        if (!hall.value) throw new Error("Please select your theatre.");
        return fetch(OWNER_API + "/login", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: u.value.trim(), password: p.value }) })
          .catch(function () { throw new Error("Cannot reach the server. Check your internet and try again."); })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) {
            if (!r.ok) throw new Error(d.error || "Could not log in.");
            if (d.hall.theatre_id !== hall.value) throw new Error("Wrong theatre, username or password.");
            (rem.checked ? localStorage : sessionStorage).setItem(OWNER_TOKEN_KEY, d.token);
            OWNER_HALL = d.hall; OWNER_LOCAL = {}; renderOwner(); return "Logged in";
          }); });
      });
    }
    b.onclick = go; p.onkeydown = function (e) { if (e.key === "Enter") go(); };
    card.appendChild(field("Theatre name", hall)); card.appendChild(field("Username", u)); card.appendChild(field("Password", p));
    card.appendChild(remLab); card.appendChild(b);
    var back = el("button", null, "\u2190 Back"); back.style.marginTop = "12px"; back.onclick = function () { showChooser(); };
    card.appendChild(back); box.appendChild(card); app.appendChild(box);
  }

  /* ---------- theatre owner: photos only ---------- */
  function prepBlob(file, max, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
        x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        (function tryQ(q) {
          c.toBlob(function (b) {
            if (!b) return reject(new Error("Could not process that photo."));
            if (b.size <= 2400000 || q <= 0.55) resolve(b); else tryQ(q - 0.07);
          }, "image/jpeg", q);
        })(quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("That file is not a photo I can read.")); };
      img.src = url;
    });
  }
  function ownerUrls(h) { return [h.photo, h.poster].concat(h.gallery || []).filter(Boolean); }
  function ownerPreview(url, ratio) {
    var wrap = el("div"); wrap.style.cssText = "background:var(--bg);border:1px solid var(--line);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;width:100%;aspect-ratio:" + ratio;
    if (!url) { var n = el("span", "muted", "No photo"); wrap.appendChild(n); return wrap; }
    var im = el("img"); im.alt = ""; im.style.cssText = "width:100%;height:100%;object-fit:contain";
    im.onerror = function () { wrap.replaceChildren(el("span", "muted", "Updating… (shows in about a minute)")); };
    im.src = OWNER_LOCAL[url] || url; wrap.appendChild(im); return wrap;
  }
  function ownerPick(label, slot, cls) {
    var b = el("button", cls || "", label), f = fileInput(); f.style.display = "none";
    f.onchange = function () {
      var file = f.files[0]; f.value = ""; if (!file) return;
      busy(b, function () {
        var max = slot === "poster" ? 1800 : slot === "photo" ? 1600 : 1400;
        var q = slot === "poster" ? 0.92 : slot === "photo" ? 0.9 : 0.88;
        return prepBlob(file, max, q).then(function (blob) {
          var before = ownerUrls(OWNER_HALL);
          return owApi("/photo/" + slot, "PUT", blob, "image/jpeg").then(function (d) {
            var added = ownerUrls(d.hall).filter(function (u) { return before.indexOf(u) < 0; })[0];
            if (added) OWNER_LOCAL[added] = URL.createObjectURL(blob);
            OWNER_HALL = d.hall; renderOwner();
            return "Saved. The website updates in about a minute.";
          });
        });
      });
    };
    b.onclick = function () { f.click(); };
    var w = el("span"); w.appendChild(b); w.appendChild(f); return w;
  }
  function ownerRemove(slot) {
    var b = el("button", "danger", "Remove");
    b.onclick = function () {
      if (!confirm("Remove this photo?")) return;
      busy(b, function () {
        return owApi("/photo/" + slot, "DELETE").then(function (d) { OWNER_HALL = d.hall; renderOwner(); return "Removed"; });
      });
    };
    return b;
  }
  function renderOwner() {
    var h = OWNER_HALL; app.replaceChildren();
    var head = el("header"), bar = el("div", "bar");
    var logo = el("img"); logo.src = "logo.png"; logo.alt = "";
    var out = el("button", null, "Log out"); out.onclick = function () { ownerLogout("You are logged out."); };
    bar.appendChild(logo); bar.appendChild(el("h1", null, h.name || "Your theatre")); bar.appendChild(out);
    head.appendChild(bar);
    var main = el("main");
    main.appendChild(el("p", "muted", "You can change photos only. Changes appear on the website in about a minute."));

    var c1 = el("div", "card"); c1.appendChild(el("h2", null, "Hall photo")); c1.appendChild(el("p", "muted", "The big photo at the top of your hall page."));
    c1.appendChild(ownerPreview(h.photo, "16/9")); var r1 = el("div", "row"); r1.style.marginTop = "10px"; r1.appendChild(ownerPick("Change hall photo", "photo", "primary")); c1.appendChild(r1);
    main.appendChild(c1);

    var c2 = el("div", "card"); c2.appendChild(el("h2", null, "Film poster")); c2.appendChild(el("p", "muted", h.film_title ? "Now showing: " + h.film_title : "The film showing now. Use a tall, clear poster."));
    var pv = ownerPreview(h.poster, "2/3"); pv.style.maxWidth = "280px"; pv.style.margin = "0 auto"; c2.appendChild(pv);
    var r2 = el("div", "row"); r2.style.marginTop = "10px"; r2.appendChild(ownerPick(h.poster ? "Change poster" : "Add poster", "poster", "primary"));
    if (h.poster) r2.appendChild(ownerRemove("poster")); c2.appendChild(r2); main.appendChild(c2);

    var c3 = el("div", "card"); c3.appendChild(el("h2", null, "Gallery")); c3.appendChild(el("p", "muted", "Up to " + MAX_GALLERY + " photos."));
    var grid = el("div"); grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:12px";
    for (var i = 0; i < MAX_GALLERY; i++) (function (i) {
      var url = (h.gallery || [])[i], cell = el("div");
      cell.appendChild(ownerPreview(url, "4/3"));
      var r = el("div", "row"); r.style.marginTop = "6px";
      if (url) { r.appendChild(ownerPick("Change", "g" + (i + 1))); r.appendChild(ownerRemove("g" + (i + 1))); }
      else if (i === (h.gallery || []).length) r.appendChild(ownerPick("Add photo", "g" + (i + 1), "primary"));
      cell.appendChild(r); grid.appendChild(cell);
    })(i);
    c3.appendChild(grid); main.appendChild(c3);
    app.appendChild(head); app.appendChild(main);
  }
  function ownerStart() {
    owApi("/me").then(function (d) { OWNER_HALL = d.hall; OWNER_LOCAL = {}; renderOwner(); })
      .catch(function (e) { if (e.message !== "Session ended") showChooser(e.message); });
  }

  if (token()) start().catch(function (e) { showLogin(e.message === "Token rejected" ? "" : e.message); });
  else if (OWNER_API && ownerToken()) ownerStart();
  else showChooser();
})();
