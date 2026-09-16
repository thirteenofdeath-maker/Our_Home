const CACHE_VERSION = "v2";
const STATIC_CACHE = `our-home-static-${CACHE_VERSION}`;
const PRIVATE_PAGE_CACHE = `our-home-private-pages-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) =>
                  key.startsWith("our-home-") &&
                  key !== STATIC_CACHE &&
                  key !== PRIVATE_PAGE_CACHE,
              )
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_PRIVATE_CACHES") return;

  event.waitUntil(
    caches.delete(PRIVATE_PAGE_CACHE).then(() => {
      event.ports[0]?.postMessage({ cleared: true });
    }),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === OFFLINE_URL
  );
}

function isPrivateAppPage(url) {
  return (
    url.pathname === "/" ||
    [
      "/calendar",
      "/categories",
      "/finance",
      "/household",
      "/onboarding",
      "/pets",
      "/profile",
      "/wallets",
    ].some(
      (prefix) =>
        url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
    )
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PRIVATE_PAGE_CACHE);

  try {
    const response = await fetch(request);
    const requestedUrl = new URL(request.url);
    const responseUrl = new URL(response.url);
    const isSamePage = requestedUrl.pathname === responseUrl.pathname;

    // Redirected sign-in pages and failed responses must never overwrite a
    // previously useful authenticated page.
    if (response.ok && !response.redirected && isSamePage) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached ?? caches.match(OFFLINE_URL);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate" && isPrivateAppPage(url)) {
    event.respondWith(networkFirstPage(request));
  }
});
