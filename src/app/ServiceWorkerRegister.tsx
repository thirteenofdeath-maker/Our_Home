"use client";

import { useEffect } from "react";

/**
 * Registers the intentionally-empty pass-through service worker
 * (public/sw.js) purely so the app meets PWA installability criteria.
 * It implements no caching strategy — see docs/ARCHITECTURE.md §8.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installability is a progressive enhancement; a failed registration
        // (e.g. unsupported browser) should never break the app.
      });
    }
  }, []);

  return null;
}
