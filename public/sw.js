const CACHE_NAME = "peeap-pos-v1";
const STATIC_CACHE = "peeap-pos-static-v1";

const APP_SHELL = [
  "/",
  "/dashboard/terminal",
  "/dashboard/products",
  "/dashboard/sales",
  "/dashboard/orders",
  "/dashboard/inventory",
  "/dashboard/customers",
  "/dashboard/kitchen",
  "/dashboard/tables",
  "/dashboard/staff",
  "/dashboard/discounts",
  "/dashboard/suppliers",
  "/dashboard/receipts",
  "/dashboard/reports",
  "/dashboard/settings",
  "/offline.html",
];

const STATIC_EXTENSIONS = [".js", ".css", ".png", ".jpg", ".jpeg", ".svg", ".ico", ".woff", ".woff2"];

function isStaticAsset(url) {
  return STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
}

function isApiCall(url) {
  return url.pathname.startsWith("/api/");
}

// Install: cache app shell and offline page
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        // Cache offline page first (critical)
        return cache.add("/offline.html").catch(() => {
          // Offline page might not exist during dev
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith("http")) return;

  // API calls: network-first with no cache fallback
  if (isApiCall(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache successful GET API responses briefly
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, cloned);
            });
          }
          return response;
        })
        .catch(() => {
          // Try cache for API calls when offline
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return new Response(
              JSON.stringify({ error: "Offline", offline: true }),
              {
                status: 503,
                headers: { "Content-Type": "application/json" },
              }
            );
          });
        })
    );
    return;
  }

  // Static assets: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(event.request, cloned);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Navigation requests (pages): network-first with offline fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful navigation responses
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, cloned);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return caches.match("/offline.html");
          });
        })
    );
    return;
  }

  // Default: network-first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
