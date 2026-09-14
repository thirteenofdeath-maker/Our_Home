// Intentionally minimal. This service worker exists only so the app meets
// PWA installability criteria in Milestone 1 — it implements NO caching
// strategy. Caching authenticated financial data is a deliberate future
// decision (see docs/ARCHITECTURE.md and docs/DOMAIN_RULES.md), not
// something to add here casually.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// No fetch handler: every request passes straight through to the network.
