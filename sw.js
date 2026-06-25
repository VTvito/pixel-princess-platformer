// sw.js — service worker for offline play (Fase 3). The game is a no-build static site, so
// a simple cache-first worker makes it fully playable offline after the first visit and lets
// it install as a real PWA (manifest.webmanifest is already in place).
//
// Strategy: precache the app shell on install; at runtime, serve any same-origin GET from the
// cache and fall back to the network (caching what it fetches). After one full play-through
// of a load, every module/asset/font/vendor file is cached, so the next visit works offline.
//
// Updating: bump CACHE on a meaningful content change. The byte change to this file makes the
// browser install the new worker, which (skipWaiting + clients.claim) activates immediately
// and the activate handler deletes the old cache, so the new content is fetched fresh.
const CACHE = "pj-v12";

// The shell that must be available even if the first visit was interrupted. Everything else
// (src modules, assets, fonts, vendored Kaplay) is cached lazily on first fetch below.
const CORE = ["./", "./index.html", "./style.css", "./manifest.webmanifest"];

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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never cache POST/etc.
  // The leaderboard API is live data — never cache it (a cached GET would freeze the standings
  // and serve stale entries). Let it hit the network; offline, the client degrades gracefully.
  if (new URL(req.url).pathname.startsWith("/api/")) return;
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            // Cache successful same-origin responses for offline use (assets, modules, vendor).
            if (res.ok && new URL(req.url).origin === self.location.origin) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          })
          .catch(() => (req.mode === "navigate" ? caches.match("./index.html") : undefined)),
    ),
  );
});
