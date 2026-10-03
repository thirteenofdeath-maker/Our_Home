"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Adds intent-based prefetching without competing with the page currently
 * being opened. Next's Link components handle viewport prefetching; forcing
 * every data-heavy route plus a second full-document warm on mount created a
 * burst of background requests on mobile connections.
 */
export function AppRoutePreloader() {
  const router = useRouter();

  useEffect(() => {
    const prefetched = new Set<string>();

    const prefetchRoute = (route: string) => {
      if (prefetched.has(route)) return;
      prefetched.add(route);
      router.prefetch(route);
    };

    if (navigator.storage?.persist)
      void navigator.storage.persist().catch(() => false);

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
    };

    document.addEventListener("pointerdown", warmIntendedLink, {
      passive: true,
    });
    document.addEventListener("focusin", warmIntendedLink);

    return () => {
      document.removeEventListener("pointerdown", warmIntendedLink);
      document.removeEventListener("focusin", warmIntendedLink);
    };
  }, [router]);

  return null;
}
