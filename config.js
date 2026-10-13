/* FilmHall Odisha — site configuration (environment, not content).
   The public pages read content from static JSON snapshots in this repo
   (see ../publish_site.py), so the site works without the CMS API or the
   Cloudflare tunnel running. The CMS origin is only used by the owner editor
   (edit.html) for saving. */
window.FILMHALL_CMS_ORIGIN = "https://api.filmhall.in";
window.FILMHALL_CMS_REGION = "odisha";
window.FILMHALL_SITE_DATA = "data";
