"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { NAV_ITEMS } from "./BottomNav";

const MAIN_APP_ROUTES = NAV_ITEMS.map((item) => item.href);

/**
 * Warms both navigation layers after the authenticated shell mounts:
 * Next's in-memory router cache makes bottom-nav taps immediate, while the
 * service worker keeps the same five page documents ready for a cold launch
 * or an unreliable connection.
 */
export function AppRoutePreloader() {
  const router = useRouter();

  useEffect(() => {
    let disposed = false;
    const generations = new Map<string, number>();
    const rewarmTimers = new Map<string, number>();

    const prefetchRoute = (route: string) => {
      const generation = (generations.get(route) ?? 0) + 1;
      generations.set(route, generation);
      router.prefetch(route, {
        kind: "full" as never,
        onInvalidate: () => {
          if (disposed || generations.get(route) !== generation) return;
          const previousTimer = rewarmTimers.get(route);
          if (previousTimer !== undefined) window.clearTimeout(previousTimer);
          const timer = window.setTimeout(() => {
            rewarmTimers.delete(route);
            if (!disposed) prefetchRoute(route);
          }, 250);
          rewarmTimers.set(route, timer);
        },
      });
    };

    const warmRouter = () => {
      for (const route of MAIN_APP_ROUTES) prefetchRoute(route);
    };

    const warmDocuments = () => {
      if (!("serviceWorker" in navigator)) return;
      void navigator.serviceWorker.ready.then((registration) => {
        if (disposed) return;
        const worker =
          navigator.serviceWorker.controller ?? registration.active;
        worker?.postMessage({
          type: "WARM_APP_ROUTES",
          routes: MAIN_APP_ROUTES,
        });
      });
    };

    const warmAll = () => {
      warmRouter();
      warmDocuments();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") warmAll();
    };

    warmAll();
    window.addEventListener("online", warmAll);
    window.addEventListener("focus", warmAll);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disposed = true;
      for (const timer of rewarmTimers.values()) window.clearTimeout(timer);
      window.removeEventListener("online", warmAll);
      window.removeEventListener("focus", warmAll);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router]);

  return null;
}
