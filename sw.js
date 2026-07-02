// sw.js — service worker for PWA install + offline play (Fase 3). The game is a no-build static
// site, so a small worker makes it installable and playable offline after the first visit.
//
// FRESHNESS MODEL (so an INSTALLED app always runs the latest deploy, while staying offline-
// capable): the app "code" is served NETWORK-FIRST, the heavy "media" CACHE-FIRST.
//   • navigations (the HTML document) + JS/CSS modules → network-first: try the network, fall back
//     to cache only when offline. A new deploy's index.html + modules are picked up immediately
//     when online; offline still boots from the last-cached copy.
//   • images / audio / fonts / vendored Kaplay → cache-first: fast, and they rarely change; a CACHE
//     bump (below) refreshes them when they do.
//
// UPDATING is automatic: tools/deploy.mjs stamps a UNIQUE id into CACHE here right before each
// deploy, so every deploy ships a byte-different sw.js → the browser installs the new worker →
// skipWaiting + clients.claim activate it at once → the activate handler deletes the old cache, so
// nothing stale survives. (The committed value below is only the dev/template default; no more
// bumping it by hand.) main.js does an update() check on load/foreground and reloads once on
// controllerchange so an open session switches to the fresh code.
const CACHE = "pj-v15";

// The shell that must be available even if the first visit was interrupted. Everything else
// (src modules, assets, fonts, vendored Kaplay) is cached lazily on first fetch below.
const CORE = ["./", "./index.html", "./style.css", "./manifest.webmanifest"];

// App "code" (served fresh-first) vs "media" (served cache-first): a navigation, or a same-site
// script/stylesheet, is code; images/audio/fonts/vendor are media.
function isCode(req, url) {
  return req.mode === "navigate" || /\.(?:js|mjs|css)$/.test(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cache a successful same-origin response for offline use (assets, modules, vendor).
function cachePut(req, res) {
  if (res.ok && new URL(req.url).origin === self.location.origin) {
    const copy = res.clone();
    caches.open(CACHE).then((cache) => cache.put(req, copy));
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never cache POST/etc.
  const url = new URL(req.url);
  // The leaderboard API is live data — never cache it (a cached GET would freeze the standings and
  // serve stale entries). Let it hit the network; offline, the client degrades gracefully.
  if (url.pathname.startsWith("/api/")) return;

  if (isCode(req, url)) {
    // NETWORK-FIRST: newest code when online; cached copy (or the app shell) when offline.
    event.respondWith(
      fetch(req)
        .then((res) => cachePut(req, res))
        .catch(() =>
          caches
            .match(req)
            .then((hit) => hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined)),
        ),
    );
    return;
  }

  // CACHE-FIRST for media/immutable assets: serve from cache, fall back to the network (and cache
  // what it fetches for next time).
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => cachePut(req, res))));
});
