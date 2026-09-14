"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BottomNav } from "./BottomNav";
import { appSectionForPath } from "@/lib/navigation/app-section";

const TOP_LEVEL_ROUTES = new Set(["/pets", "/calendar", "/household"]);

/**
 * The Finance routes with no module-specific creation action of their
 * own (currently net-worth only) — these get the generic
 * quick-add-a-transaction FAB (GlobalQuickAdd). Budgets/installments/
 * debts/goals each render their OWN contextual FAB directly inside their
 * page (they're the only ones that know whether their own list is
 * empty, which decides whether that FAB would duplicate their
 * FinanceEmptyState CTA — see each page's own FloatingActionButton
 * usage), so they're deliberately excluded here. Deep task pages
 * (new/edit/detail/quick-add itself) get no FAB at all.
 */
const FINANCE_GENERIC_FAB_ROUTES = new Set(["/finance/net-worth"]);

export function AppShell({
  children,
  globalHeader,
  financeQuickAdd,
}: {
  children: ReactNode;
  globalHeader: ReactNode;
  financeQuickAdd: ReactNode;
}) {
  const pathname = usePathname();
  const isTopLevel = TOP_LEVEL_ROUTES.has(pathname);
  // BottomNav now persists across the ENTIRE authenticated app — every
  // route under (app), at any depth, in any section — with exactly one
  // exception: Onboarding, which has nothing yet to navigate between.
  // `appSectionForPath` is the single shared classifier BottomNav itself
  // also reads (for active-tab/tone), so the two can never disagree about
  // which routes count as "in the app". The top app header ("Our Home" +
  // avatar) stays exact-top-level-only, a deliberately separate concern
  // from BottomNav persistence. Finance deliberately omits it because its
  // overview already provides the complete module entry surface.
  const showBottomNav = appSectionForPath(pathname) !== "onboarding";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {isTopLevel ? globalHeader : null}
      {/* The bottom padding must clear BOTH the floating BottomNav AND,
          on top of it, a bottom-right FAB where one exists — plus the
          real safe-area inset, not a guessed fixed value, so an iPhone's
          home indicator never eats into it. Applied uniformly wherever
          BottomNav renders (even on a FAB-less deep page) rather than
          computed per-route, so no page can under-clear it by omission. */}
      <main
        className={`mx-auto w-full max-w-xl flex-1 px-4 ${showBottomNav ? "pb-[calc(env(safe-area-inset-bottom)+10rem)] pt-2" : "pb-8 pt-1"}`}
      >
        {children}
      </main>
      {showBottomNav ? <BottomNav /> : null}
      {FINANCE_GENERIC_FAB_ROUTES.has(pathname) ? financeQuickAdd : null}
    </div>
  );
}
