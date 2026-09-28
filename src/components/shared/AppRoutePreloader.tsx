"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { NAV_ITEMS } from "./BottomNav";

const MAIN_APP_ROUTES = NAV_ITEMS.map((item) => item.href);
const CORE_DOCUMENT_ROUTES = [
  ...MAIN_APP_ROUTES,
  "/calendar?view=shopping",
  "/calendar?view=chores",
  "/calendar?view=inventory",
];

/**
 * Warms both navigation layers after the authenticated shell mounts:
 * Next's in-memory router cache makes bottom-nav taps immediate, while the
 * service worker keeps the core and high-frequency page documents ready for
 * a cold launch or an unreliable connection.
 */
export function AppRoutePreloader() {
  const router = useRouter();

  useEffect(() => {
    let disposed = false;
    const prefetched = new Set<string>();

    const prefetchRoute = (route: string) => {
      if (prefetched.has(route)) return;
      prefetched.add(route);
      router.prefetch(route, { kind: "full" as never });
    };

    const warmRouter = () => {
      for (const route of MAIN_APP_ROUTES) prefetchRoute(route);
    };

    const warmDocuments = (routes = CORE_DOCUMENT_ROUTES) => {
      if (!("serviceWorker" in navigator)) return;
      void navigator.serviceWorker.ready.then((registration) => {
        if (disposed) return;
        const worker =
          navigator.serviceWorker.controller ?? registration.active;
        worker?.postMessage({
          type: "WARM_APP_ROUTES",
          routes,
        });
      });
    };

    const warmAll = () => {
      warmRouter();
      warmDocuments();
    };

    if (navigator.storage?.persist)
      void navigator.storage.persist().catch(() => false);

    // Start Next's low-priority route prefetch as soon as the authenticated
    // shell hydrates. Waiting for the browser to become idle left a 0.8–2s
    // window where an early bottom-nav tap still had to show loading.tsx.
    // The service-worker document warm remains idle work because it performs
    // real network/cache I/O and must not compete with the current page.
    warmRouter();
    const scheduleDocumentWarm = () => {
      if (typeof window.requestIdleCallback === "function") {
        return window.requestIdleCallback(() => warmDocuments(), {
          timeout: 2000,
        });
      }
      return globalThis.setTimeout(
        () => warmDocuments(),
        800,
      ) as unknown as number;
    };

    const idleHandle = scheduleDocumentWarm();
    const warmIntendedLink = (event: PointerEvent | FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>('a[href^="/"]');
      if (!link) return;
      const url = new URL(link.href);
      if (
        url.origin !== window.location.origin ||
        !/^\/(finance|wallets|categories|calendar|pets|household|profile|shopping|chores|inventory)(\/|$)/.test(
          url.pathname,
        )
      )
        return;
      const route = url.pathname + url.search;
      prefetchRoute(route);
      warmDocuments([route]);
    };

    window.addEventListener("online", warmAll);
    document.addEventListener("pointerdown", warmIntendedLink, {
      passive: true,
    });
    document.addEventListener("focusin", warmIntendedLink);

    return () => {
      disposed = true;
      if (typeof window.cancelIdleCallback === "function")
        window.cancelIdleCallback(idleHandle);
      else globalThis.clearTimeout(idleHandle);
      window.removeEventListener("online", warmAll);
      document.removeEventListener("pointerdown", warmIntendedLink);
      document.removeEventListener("focusin", warmIntendedLink);
    };
  }, [router]);

  return null;
}
