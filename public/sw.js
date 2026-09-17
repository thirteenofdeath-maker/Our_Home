const CACHE_VERSION = "persistent-v1";
let cacheGeneration = 0;
const STATIC_CACHE = `our-home-static-${CACHE_VERSION}`;
const PRIVATE_PAGE_CACHE = `our-home-private-pages-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-maskable.svg",
  "/icons/icon-180.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// Keep stored pages and assets across app updates and browser restarts.
// They are replaced by fresh responses, not cleared on a timer.
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

async function clearPrivateCaches() {
  cacheGeneration += 1;
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith("our-home-"))
      .map((key) => caches.delete(key)),
  );
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_PRIVATE_CACHES") {
    event.waitUntil(
      clearPrivateCaches().then(() => {
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
    url.pathname.startsWith("/art/") ||
    url.pathname.startsWith("/_next/image") ||
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

const REVISION_KEY = "/__cache_revision__";
async function getRevision(cache) {
  const response = await cache.match(
    new URL(REVISION_KEY, self.location.origin),
  );
  return response ? response.text() : "initial";
}

async function fetchAndCachePrivatePage(request) {
  const generation = cacheGeneration;
  const cache = await caches.open(PRIVATE_PAGE_CACHE);
  const revision = await getRevision(cache);
  const response = await fetch(request);
  const requestedUrl = new URL(request.url);
  const responseUrl = new URL(response.url);
  const isSamePage = requestedUrl.pathname === responseUrl.pathname;

  // Redirected sign-in pages and failed responses must never overwrite a
  // previously useful authenticated page.
  if (generation !== cacheGeneration) return response;
  const owner = response.headers.get("X-Our-Home-User");
  const contentType = response.headers.get("content-type") || "";
  if (
    response.ok &&
    !response.redirected &&
    isSamePage &&
    owner &&
    contentType.includes("text/html")
  ) {
    const headers = new Headers(response.headers);
    headers.set("X-Our-Home-Cache-Revision", revision);
    const stored = new Response(await response.clone().arrayBuffer(), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
    const identityKey = new URL("/__cache_owner__", self.location.origin).href;
    const previousOwner = await cache.match(identityKey);
    if (previousOwner && (await previousOwner.text()) !== owner) {
      await clearPrivateCaches();
      const fresh = await caches.open(PRIVATE_PAGE_CACHE);
      await fresh.put(identityKey, new Response(owner));
      await fresh.put(request, stored);
    } else if (generation === cacheGeneration) {
      await cache.put(identityKey, new Response(owner));
      await cache.put(request, stored);
    }
  } else if (
    response.status === 401 ||
    response.status === 403 ||
    (response.redirected && new URL(response.url).pathname === "/login")
  ) {
    await clearPrivateCaches();
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

  if (
    !cached ||
    cached.headers.get("X-Our-Home-Cache-Revision") !==
      (await getRevision(cache))
  ) {
    return networkFirstPage(request);
  }

  // Paint the already-known page immediately, then refresh its copy without
  // holding up navigation. The next visit receives the newest successful page.
  event.waitUntil(fetchAndCachePrivatePage(request).catch(() => undefined));
  return cached;
}

async function warmMainAppRoutes(routes) {
  if (!Array.isArray(routes)) return;

  const allowedRoutes = routes.filter(
    (route) =>
      typeof route === "string" &&
      route.startsWith("/") &&
      !route.startsWith("//") &&
      isPrivateAppPage(new URL(route, self.location.origin)),
  );

  // Four concurrent reads keep background warming from swamping navigation.
  const pending = [...new Set(allowedRoutes)];
  const generation = cacheGeneration;
  await Promise.allSettled(
    Array.from({ length: 4 }, async () => {
      while (pending.length && generation === cacheGeneration) {
        const route = pending.shift();
        const url = new URL(route, self.location.origin);
        try {
          await fetchAndCachePrivatePage(
            new Request(url, { credentials: "include", cache: "no-store" }),
          );
        } catch {
          /* Keep the existing cached page when offline. */
        }
      }
    }),
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.method === "POST") {
    event.respondWith(
      (async () => {
        // Mark old snapshots stale after a write, retaining them as offline fallback.
        const cache = await caches.open(PRIVATE_PAGE_CACHE);
        await cache.put(
          new URL(REVISION_KEY, self.location.origin),
          new Response(crypto.randomUUID()),
        );
        return fetch(request);
      })(),
    );
    return;
  }
  if (request.method !== "GET") return;

  if (
    request.mode === "navigate" &&
    ["/login", "/sign-up"].includes(url.pathname)
  ) {
    event.respondWith(clearPrivateCaches().then(() => fetch(request)));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    if (!url.pathname.startsWith("/_next/static/")) {
      event.waitUntil(
        fetch(request)
          .then(async (response) => {
            if (response.ok)
              await (await caches.open(STATIC_CACHE)).put(request, response);
          })
          .catch(() => undefined),
      );
    }
    return;
  }

  if (request.mode === "navigate" && isPrivateAppPage(url)) {
    event.respondWith(cacheFirstMainPage(event, request));
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
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || "our-home-notification",
    renotify: false,
    data: { url: payload.url || "/" },
  };
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      "setAppBadge" in self.navigator
        ? self.navigator.setAppBadge(1)
        : Promise.resolve(),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || "/",
    self.location.origin,
  ).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        const exact = clients.find((client) => client.url === target);
        if (exact) return exact.focus();
        const existing = clients.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );
        if (existing) {
          await existing.navigate(target);
          return existing.focus();
        }
        return self.clients.openWindow(target);
      }),
  );
});
