const CACHE_VERSION = "v4";
const STATIC_CACHE = `our-home-static-${CACHE_VERSION}`;
const PRIVATE_PAGE_CACHE = `our-home-private-pages-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-maskable.svg",
];
const MAIN_APP_ROUTES = new Set([
  "/",
  "/finance",
  "/calendar",
  "/pets",
  "/household",
]);

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
  if (event.data?.type === "CLEAR_PRIVATE_CACHES") {
    event.waitUntil(
      caches.delete(PRIVATE_PAGE_CACHE).then(() => {
        event.ports[0]?.postMessage({ cleared: true });
      }),
    );
    return;
  }

  if (event.data?.type === "WARM_APP_ROUTES") {
    event.waitUntil(warmMainAppRoutes(event.data.routes));
  }
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

async function fetchAndCachePrivatePage(request) {
  const cache = await caches.open(PRIVATE_PAGE_CACHE);
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
}

async function networkFirstPage(request) {
  const cache = await caches.open(PRIVATE_PAGE_CACHE);

  try {
    return await fetchAndCachePrivatePage(request);
  } catch {
    const cached = await cache.match(request);
    return cached ?? caches.match(OFFLINE_URL);
  }
}

async function cacheFirstMainPage(event, request) {
  const cache = await caches.open(PRIVATE_PAGE_CACHE);
  const cached = await cache.match(request);

  if (!cached) return networkFirstPage(request);

  // Paint the already-known page immediately, then refresh its copy without
  // holding up navigation. The next visit receives the newest successful page.
  event.waitUntil(fetchAndCachePrivatePage(request).catch(() => undefined));
  return cached;
}

async function warmMainAppRoutes(routes) {
  if (!Array.isArray(routes)) return;

  const allowedRoutes = routes.filter(
    (route) => typeof route === "string" && MAIN_APP_ROUTES.has(route),
  );

  await Promise.allSettled(
    allowedRoutes.map((route) => {
      const url = new URL(route, self.location.origin);
      const request = new Request(url, {
        credentials: "include",
        cache: "no-store",
      });
      return fetchAndCachePrivatePage(request);
    }),
  );
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
    event.respondWith(
      MAIN_APP_ROUTES.has(url.pathname)
        ? cacheFirstMainPage(event, request)
        : networkFirstPage(request),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() };
  }

  const title = payload.title || "Our Home";
  const options = {
    body: payload.body || "มีรายการใหม่ที่ควรดู",
    icon: "/icons/icon.svg",
    badge: "/icons/icon.svg",
    tag: payload.tag || "our-home-notification",
    renotify: false,
    data: { url: payload.url || "/" },
  };
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      "setAppBadge" in self.navigator ? self.navigator.setAppBadge(1) : Promise.resolve(),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const exact = clients.find((client) => client.url === target);
      if (exact) return exact.focus();
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.navigate(target);
        return existing.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
