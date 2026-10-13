/*!
 * FilmHall Odisha — development page.
 *
 * A numbered table of the film halls HQ published: film hall name, theatre
 * owner and district. Each name links to that theatre's page (page 3).
 */
(function () {
  "use strict";

  var FH = window.FilmHall;

  function row(index, theatre) {
    var tr = document.createElement("tr");

    var num = FH.el("td", "dev-num", String(index));
    tr.appendChild(num);

    var name = document.createElement("td");
    var a = document.createElement("a");
    a.className = "dev-hall-link";
    a.href = "theatre.html?id=" + encodeURIComponent(String(theatre.theatre_id || theatre.id || ""));
    a.textContent = theatre.name || "FilmHall";
    name.appendChild(a);
    tr.appendChild(name);

    tr.appendChild(FH.el("td", "dev-owner", theatre.owner_name || "\u2014"));
    tr.appendChild(FH.el("td", "dev-district", theatre.district || "\u2014"));
    return tr;
  }

  function boot() {
    var body = FH.qs("#dev-rows");
    if (!body) return;

    FH.getJSON(FH.base + "/home.json").then(function (payload) {
      FH.setMedia(payload && payload.media);
      var theatres = (payload && payload.theatres) || [];
      while (body.firstChild) body.removeChild(body.firstChild);
      if (!theatres.length) {
        var empty = document.createElement("tr");
        var cell = FH.el("td", "page-message", "No film halls published yet.");
        cell.colSpan = 4;
        empty.appendChild(cell);
        body.appendChild(empty);
        return;
      }
      var frag = document.createDocumentFragment();
      for (var i = 0; i < theatres.length; i++) {
        frag.appendChild(row(i + 1, theatres[i]));
      }
      body.appendChild(frag);
    }).catch(function (err) {
      if (window.console && console.warn) {
        console.warn("[FilmHall development] not loaded:", err && err.message ? err.message : err);
      }
      while (body.firstChild) body.removeChild(body.firstChild);
      var tr = document.createElement("tr");
      var cell = FH.el("td", "page-message", "Film halls could not be loaded right now.");
      cell.colSpan = 4;
      tr.appendChild(cell);
      body.appendChild(tr);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
