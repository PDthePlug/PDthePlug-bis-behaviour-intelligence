/* BIS installation foundation. Only the generic offline screen and public mark
   are cached. Auth, APIs, workbook responses and authenticated HTML stay online. */
const CACHE = "bis-public-v1";
const OFFLINE = "/offline.html";
const PUBLIC_ASSETS = [OFFLINE, "/brand/bis-icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const path of PUBLIC_ASSETS) {
      const response = await fetch(new Request(path, { cache: "reload", credentials: "omit" }));
      if (!response.ok || response.redirected) throw new Error("BIS offline asset unavailable");
      await cache.put(path, response);
    }
  })());
  // Let updates wait for existing pages to close; never reload unsaved work.
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith("bis-public-") && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (PUBLIC_ASSETS.includes(url.pathname) && !url.search) {
    event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match(url.pathname)) || fetch(request)));
    return;
  }
  if (request.mode !== "navigate") return;
  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match(OFFLINE)) || new Response("BIS is offline. Reconnect and try again.", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }));
});
