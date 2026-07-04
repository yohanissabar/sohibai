const CACHE_NAME = "sohibai-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(["/", "/index.html", "/manifest.json", "/icon-512.png"])));
});
self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/api/")) return;
  event.respondWith(caches.match(event.request).then((res) => res || fetch(event.request)));
});
