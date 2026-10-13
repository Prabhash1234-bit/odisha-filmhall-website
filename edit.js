/* FilmHall Theatre Editor - one page.
   Login (handle + password) -> edit contact, social links and gallery
   photos -> Save. The theatre photo itself is set by FilmHall HQ, so the
   owner never touches it here. */
(function () {
  "use strict";

  var ORIGIN = String(window.FILMHALL_CMS_ORIGIN || "https://api.filmhall.in").replace(/\/+$/, "");
  var REGION = String(window.FILMHALL_CMS_REGION || "odisha");
  var TOKEN_KEY = "fh_owner_token";

  var editor = document.getElementById("editor");
  var tid = (window.FilmHall && FilmHall.param("tid")) || new URLSearchParams(location.search).get("tid") || "";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }

  function field(labelText, input) {
    var box = el("div", "edit-field");
    box.appendChild(el("label", null, labelText));
    box.appendChild(input);
    return box;
  }

  function textInput(id, value, placeholder) {
    var i = el("input"); i.type = "text"; i.id = id;
    i.value = value || "";
    if (placeholder) i.placeholder = placeholder;
    return i;
  }

  function text(value) {
    return (window.FilmHall && FilmHall.text && FilmHall.text(value)) || null;
  }

  function msg(text, isError) {
    var box = document.getElementById("edit-msg");
    if (!box) return;
    box.textContent = text || "";
    box.className = "edit-msg" + (isError ? " edit-msg-error" : " edit-msg-ok");
  }

  function api(path, options) {
    options = options || {};
    var headers = options.headers || {};
    var token = localStorage.getItem(TOKEN_KEY);
    if (token) headers["Authorization"] = "Bearer " + token;
    options.headers = headers;
    options.credentials = "omit";
    options.mode = "cors";
    return fetch(ORIGIN + path, options).then(function (res) {
      return res.text().then(function (body) {
        var data = null;
        try { data = body ? JSON.parse(body) : null; } catch (e) { data = null; }
        if (!res.ok) {
          var detail = (data && data.detail) || ("HTTP " + res.status);
          throw new Error(typeof detail === "string" ? detail : "Request failed");
        }
        return data;
      });
    });
  }

  function showLogin() {
    editor.innerHTML = "";
    var card = el("div", "edit-card");
    card.appendChild(el("h2", null, "Theatre Owner Login"));
    card.appendChild(el("p", "muted", "Sign in to manage your hall."));

    var hi = textInput("login-handle");
    hi.autocomplete = "username";
    var pi = el("input"); pi.type = "password"; pi.id = "login-password"; pi.autocomplete = "current-password";

    var btn = el("button", "btn btn-primary", "Sign in");
    var out = el("p", "edit-msg"); out.id = "edit-msg";

    btn.addEventListener("click", function () {
      msg("");
      api("/cms/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: hi.value.trim(), password: pi.value })
      }).then(function (data) {
        localStorage.setItem(TOKEN_KEY, data.token);
        showForm();
      }).catch(function (err) { msg(err.message, true); });
    });

    pi.addEventListener("keydown", function (e) { if (e.key === "Enter") btn.click(); });

    card.appendChild(field("Username", hi));
    card.appendChild(field("Password", pi));
    card.appendChild(btn);
    card.appendChild(out);
    editor.appendChild(card);
  }

  function galleryPreview(container, theatreId) {
    api("/cms/public/" + encodeURIComponent(REGION) + "/theatres/" +
        encodeURIComponent(theatreId) + "/gallery").then(function (payload) {
      var items = (payload && payload.items) || [];
      if (!items.length) return;
      container.appendChild(el("p", "muted", "Current photos (" + items.length + ")"));
      var grid = el("div", "edit-gallery");
      items.forEach(function (item) {
        var img = el("img");
        img.alt = "Gallery photo";
        img.src = ORIGIN + "/cms/public/media/" + encodeURIComponent(item.id) + "/file";
        grid.appendChild(img);
      });
      container.appendChild(grid);
    }).catch(function () { /* preview is best effort */ });
  }

  function showForm() {
    api("/cms/my/theatre").then(function (theatre) {
      var id = theatre.theatre_id || theatre.id || tid;
      if (!id) throw new Error("This account is not linked to a theatre.");

      var meta = (theatre.meta_json && typeof theatre.meta_json === "object")
        ? Object.assign({}, theatre.meta_json) : {};
      var social = (theatre.social_json && typeof theatre.social_json === "object")
        ? Object.assign({}, theatre.social_json) : {};

      editor.innerHTML = "";
      var card = el("div", "edit-card");
      card.appendChild(el("h2", null, theatre.name || id));
      card.appendChild(el("p", "muted", (theatre.district || REGION) + " \u00B7 " + id +
        " \u00B7 status: " + (theatre.record_status || "draft")));

      var phone = textInput("f-phone", text(meta.phone), "e.g. 9876543210");
      phone.type = "tel";
      var whatsapp = textInput("f-whatsapp", text(meta.whatsapp), "leave blank to use the phone number");
      whatsapp.type = "tel";
      var facebook = textInput("f-facebook", text(social.facebook), "https://www.facebook.com/...");
      var instagram = textInput("f-instagram", text(social.instagram), "https://www.instagram.com/...");
      var youtube = textInput("f-youtube", text(social.youtube), "https://youtube.com/...");

      var file = el("input"); file.type = "file"; file.accept = "image/*"; file.multiple = true; file.id = "f-gallery";

      card.appendChild(el("p", "muted", "Customers tap Call / WhatsApp to book."));
      card.appendChild(field("Contact phone", phone));
      card.appendChild(field("WhatsApp number", whatsapp));
      card.appendChild(el("hr", "edit-sep"));
      card.appendChild(field("Facebook link", facebook));
      card.appendChild(field("Instagram link", instagram));
      card.appendChild(field("YouTube link", youtube));
      card.appendChild(el("hr", "edit-sep"));
      card.appendChild(field("Add gallery photos", file));

      var preview = el("div", "edit-preview");
      card.appendChild(preview);
      galleryPreview(preview, id);

      var save = el("button", "btn btn-primary", "Save");
      var logout = el("button", "btn btn-secondary", "Log out");
      logout.style.marginLeft = "8px";
      var out = el("p", "edit-msg"); out.id = "edit-msg";

      logout.addEventListener("click", function () {
        localStorage.removeItem(TOKEN_KEY);
        showLogin();
      });

      save.addEventListener("click", function () {
        msg("Saving...");
        save.disabled = true;

        var files = file.files ? Array.prototype.slice.call(file.files) : [];
        var chain = Promise.resolve();
        files.forEach(function (chosen) {
          chain = chain.then(function () {
            return api(
              "/cms/media?region=" + encodeURIComponent(REGION) +
              "&kind=photo&owner_theatre_id=" + encodeURIComponent(id) +
              "&filename=" + encodeURIComponent(chosen.name),
              { method: "POST", headers: { "Content-Type": chosen.type || "application/octet-stream" }, body: chosen }
            );
          });
        });

        chain.then(function () {
          var nextMeta = Object.assign({}, meta);
          var nextSocial = Object.assign({}, social);
          var p = phone.value.trim();
          var w = whatsapp.value.trim();
          var fb = facebook.value.trim();
          var ig = instagram.value.trim();
          var yt = youtube.value.trim();

          if (p) nextMeta.phone = p; else delete nextMeta.phone;
          if (w) nextMeta.whatsapp = w; else delete nextMeta.whatsapp;
          if (fb) nextSocial.facebook = fb; else delete nextSocial.facebook;
          if (ig) nextSocial.instagram = ig; else delete nextSocial.instagram;
          if (yt) nextSocial.youtube = yt; else delete nextSocial.youtube;

          return api("/cms/theatres/" + encodeURIComponent(id), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ meta_json: nextMeta, social_json: nextSocial })
          });
        }).then(function () {
          msg("Saved. Your hall page is updated.");
          save.disabled = false;
          setTimeout(showForm, 800);
        }).catch(function (err) {
          msg(err.message, true);
          save.disabled = false;
        });
      });

      card.appendChild(save);
      card.appendChild(logout);
      card.appendChild(out);
      editor.appendChild(card);
    }).catch(function (err) {
      if (/401|403|token|session|sign/i.test(err.message)) {
        localStorage.removeItem(TOKEN_KEY);
        showLogin();
      } else {
        editor.innerHTML = "";
        var card = el("div", "edit-card");
        card.appendChild(el("h2", null, "Theatre Editor"));
        card.appendChild(el("p", "edit-msg edit-msg-error", err.message));
        editor.appendChild(card);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!editor) return;
    if (!tid) {
      var card = el("div", "edit-card");
      card.appendChild(el("h2", null, "Theatre Editor"));
      card.appendChild(el("p", "muted", "Open this page using your hall's own link (it ends with ?tid=...)."));
      editor.appendChild(card);
      return;
    }
    showLogin();
  });
})();
