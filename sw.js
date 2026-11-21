/* XRPL2 — service worker: portal tetap bisa dibuka saat sinyal jelek.
   Strategi: ambil dari jaringan dulu (selalu versi terbaru), cadangan dari cache.
   Naikkan nomor CACHE jika mengganti daftar file di SHELL. */
const CACHE = "xrpl2-v1";
const SHELL = [
  "./",
  "index.html",
  "style.css",
  "script.js",
  "Fitur.css",
  "Fitur.js",
  "Fitur2.css",
  "Fitur2.js",
  "firebase-config.js",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase, CDN, dll. tidak disentuh

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(req)
          .then(
            (hit) =>
              hit ||
              (req.mode === "navigate"
                ? caches.match("index.html")
                : Response.error()),
          ),
      ),
  );
});
