"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { NAV_ITEMS } from "./BottomNav";

import { FINANCE_MODULES } from "@/features/finance/components/FinanceModuleTabs";

const MAIN_APP_ROUTES = NAV_ITEMS.map((item) => item.href);

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
      const routes = new Set([
        ...MAIN_APP_ROUTES,
        ...FINANCE_MODULES.map((module) => module.href),
        "/household/members",
        "/profile/edit",
        "/profile/notifications",
        "/shopping",
      ]);
      for (const route of routes) prefetchRoute(route);
    };

    const warmDocuments = () => {
      if (!("serviceWorker" in navigator)) return;
      void navigator.serviceWorker.ready.then((registration) => {
        if (disposed) return;
        const worker =
          navigator.serviceWorker.controller ?? registration.active;
        worker?.postMessage({
          type: "WARM_APP_ROUTES",
          routes: [
            ...MAIN_APP_ROUTES,
            ...FINANCE_MODULES.map((module) => module.href),
            "/household/members",
            "/profile/edit",
            "/profile/notifications",
            "/shopping",
          ],
        });
      });
    };

    const warmAll = () => {
      if (navigator.onLine) router.refresh();
      warmRouter();
      warmDocuments();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") warmAll();
    };

    if (navigator.storage?.persist)
      void navigator.storage.persist().catch(() => false);
    warmAll();
    const seen = new Set<string>();
    const warmLinkedPages = () => {
      const routes: string[] = [];
      document
        .querySelectorAll<HTMLAnchorElement>('a[href^="/"]')
        .forEach((link) => {
          const url = new URL(link.href);
          if (
            url.origin !== window.location.origin ||
            !/^\/(finance|wallets|categories|calendar|pets|household|profile|shopping)(\/|$)/.test(
              url.pathname,
            )
          )
            return;
          const route = url.pathname + url.search;
          if (seen.has(route)) return;
          seen.add(route);
          prefetchRoute(route);
          routes.push(route);
        });
      if (routes.length)
        navigator.serviceWorker?.controller?.postMessage({
          type: "WARM_APP_ROUTES",
          routes,
        });
    };
    let linkTimer: number | undefined;
    const observer = new MutationObserver(() => {
      window.clearTimeout(linkTimer);
      linkTimer = window.setTimeout(warmLinkedPages, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    warmLinkedPages();
    window.addEventListener("online", warmAll);
    window.addEventListener("focus", warmAll);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disposed = true;
      observer.disconnect();
      window.clearTimeout(linkTimer);
      for (const timer of rewarmTimers.values()) window.clearTimeout(timer);
      window.removeEventListener("online", warmAll);
      window.removeEventListener("focus", warmAll);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router]);

  return null;
}
