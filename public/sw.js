/* ScoreFit service worker — dependency-free, defensive.
   Strategy:
   - install: take over immediately.
   - activate: claim clients, drop stale caches.
   - fetch: same-origin GET (navigation/static) -> stale-while-revalidate.
            i.ytimg.com image GET -> cache-first.
            everything else (POST /api/logs, cross-origin API) -> not intercepted;
            the app's own localStorage outbox handles offline writes.
   Nothing here should ever break navigation. */

const CACHE = "scorefit-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        );
      } catch (_e) {
        // ignore cache cleanup failures
      }
      await self.clients.claim();
    })(),
  );
});

async function staleWhileRevalidate(request) {
  try {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    const network = fetch(request)
      .then((response) => {
        if (response && response.ok) {
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      })
      .catch(() => undefined);
    return cached || (await network) || fetch(request);
  } catch (_e) {
    return fetch(request);
  }
}

async function cacheFirst(request) {
  try {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (_e) {
    return fetch(request);
  }
}

self.addEventListener("fetch", (event) => {
  try {
    const request = event.request;

    // Only ever handle GETs. POST /api/logs and friends pass straight through.
    if (request.method !== "GET") return;

    const url = new URL(request.url);

    // YouTube thumbnails: cache-first.
    if (url.hostname === "i.ytimg.com" && request.destination === "image") {
      event.respondWith(cacheFirst(request));
      return;
    }

    // Same-origin navigation + static assets: stale-while-revalidate.
    if (url.origin === self.location.origin) {
      event.respondWith(staleWhileRevalidate(request));
      return;
    }

    // Cross-origin (third-party APIs, etc.): don't intercept.
    return;
  } catch (_e) {
    // Never break the request pipeline.
    return;
  }
});
