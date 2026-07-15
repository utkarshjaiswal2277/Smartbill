// sw.js — minimal app-shell cache so the installed PWA has an offline fallback
// and satisfies Chrome/Android's installability requirement of a fetch handler.
const CACHE_NAME = "pos-shell-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Network-first for API/data calls (Supabase, Claude API) so data stays live;
  // cache-first for the app shell so the installed icon opens instantly offline.
  const url = new URL(event.request.url);
  const isAppShell = event.request.mode === "navigate" || APP_SHELL.includes(url.pathname);

  if (isAppShell) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
  // All other requests (Supabase, Claude API, fonts) pass through untouched.
});
