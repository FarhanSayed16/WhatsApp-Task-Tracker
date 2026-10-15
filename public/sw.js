const CACHE_NAME = "task-tracker-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Network-only for API and cron calls
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Network first with cache fallback for navigation pages
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((cached) => {
          return (
            cached ||
            new Response(
              `<!DOCTYPE html>
              <html lang="en">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>Offline — WhatsApp Task Tracker</title>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090d16; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 20px; }
                    .card { background: #131b2e; border: 1px solid #1e293b; padding: 32px; border-radius: 20px; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                    h1 { color: #10b981; font-size: 20px; margin-bottom: 8px; }
                    p { font-size: 14px; color: #94a3b8; line-height: 1.5; margin-bottom: 24px; }
                    button { background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 12px; font-weight: 600; font-size: 14px; cursor: pointer; }
                  </style>
                </head>
                <body>
                  <div class="card">
                    <h1>You are currently offline</h1>
                    <p>WhatsApp Task Tracker requires an active internet connection to synchronize checklist updates. Please reconnect and try again.</p>
                    <button onclick="window.location.reload()">Retry Connection</button>
                  </div>
                </body>
              </html>`,
              {
                headers: { "Content-Type": "text/html; charset=utf-8" },
              }
            )
          );
        });
      })
    );
    return;
  }

  // Cache-first for static media, icons, fonts
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|woff2|woff|ttf|css|js)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }
          const toCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, toCache));
          return response;
        });
      })
    );
  }
});
