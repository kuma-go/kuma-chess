const CACHE_NAME = "kuma-chess-20260715-mobile14";
const MODULE_VERSION = "20260715-mobile14";
const APP_MODULE_PATHS = [
  "./src/adManager.js",
  "./src/feedback.js",
  "./src/i18n.js",
  "./src/main.js",
  "./src/menuBgm.js",
  "./src/pieceAssets.js",
  "./src/pieceStyles.js",
  "./src/playerState.js",
  "./src/puzzles.js",
  "./src/scenes/Boot.js",
  "./src/scenes/Game.js",
  "./src/scenes/PieceSelect.js",
  "./src/scenes/PieceSelectAI.js",
  "./src/scenes/Puzzle.js",
  "./src/scenes/PuzzleSelect.js",
  "./src/scenes/Result.js",
  "./src/scenes/Start.js",
  "./src/ui/ConfirmPopup.js",
  "./src/ui/KumaUi.js",
  "./src/ui/NineSlice.js",
  "./src/ui/PlayInfoPopup.js",
  "./src/ui/SpriteButton.js",
  "./src/vendor-chess.js"
];
const CORE_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./app-init.js",
  "./ads-config.js",
  "./privacy.html",
  "./guide.html",
  "./robots.txt",
  "./sitemap.xml",
  "./ads.txt",
  "./docs.css",
  "./docs.js",
  "./phaser.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png",
  `./app-init.js?v=${MODULE_VERSION}`,
  ...APP_MODULE_PATHS.map((path) => `${path}?v=${MODULE_VERSION}`)
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Let the browser handle media range requests and streaming semantics directly.
  if (url.pathname.includes("/assets/audio/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => (
        caches.match(event.request).then((cached) => cached || caches.match("./index.html"))
      ))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
