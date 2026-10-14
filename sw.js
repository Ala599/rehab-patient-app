// Service worker : permet d'ouvrir l'application même sans réseau, une fois chargée une première fois.
//
// - Fichiers de l'application (même site) : "réseau d'abord", avec copie en secours.
//   Vos modifications apparaissent donc tout de suite, sans vider le cache.
// - Fichiers MediaPipe (modèle, WebAssembly sur les CDN) : "cache d'abord",
//   car ils sont versionnés et lourds ; ils sont enregistrés au premier lancement avec internet.
//
// Si vous ajoutez ou renommez un fichier de la liste PRECACHE, changez VERSION.

const VERSION = "v3";
const CACHE = `rehab-${VERSION}`;

const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./config/exercises/elbow_flexion.json",
  "./src/auth.js",
  "./src/calibration.js",
  "./src/camera.js",
  "./src/chat.js",
  "./src/dom.js",
  "./src/drawing.js",
  "./src/exerciseEngine.js",
  "./src/exerciseFlow.js",
  "./src/format.js",
  "./src/geometry.js",
  "./src/history.js",
  "./src/main.js",
  "./src/poseDetector.js",
  "./src/repCounter.js",
  "./src/sessionSummary.js",
  "./src/shell.js",
  "./src/smoothing.js",
  "./src/store.js",
  "./src/today.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

const CDN_HOSTS = ["cdn.jsdelivr.net", "storage.googleapis.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("rehab-") && k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const page = await cache.match("./index.html");
      if (page) return page;
    }
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
});
