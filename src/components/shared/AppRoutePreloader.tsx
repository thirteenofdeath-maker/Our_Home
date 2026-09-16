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
    for (const route of MAIN_APP_ROUTES) {
      router.prefetch(route);
    }

    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.ready.then((registration) => {
      const worker = navigator.serviceWorker.controller ?? registration.active;
      worker?.postMessage({
        type: "WARM_APP_ROUTES",
        routes: MAIN_APP_ROUTES,
      });
    });
  }, [router]);

  return null;
}
