"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BottomNav } from "./BottomNav";

const TOP_LEVEL_ROUTES = new Set(["/finance", "/pets", "/calendar", "/household"]);
const MODULE_PREFIXES = ["/finance", "/pets", "/calendar", "/household"] as const;

/**
 * The Finance routes with no module-specific creation action of their
 * own (dashboard, reports, net-worth) — these get the generic
 * quick-add-a-transaction FAB (GlobalQuickAdd). Budgets/installments/
 * debts/goals each render their OWN contextual FAB directly inside their
 * page (they're the only ones that know whether their own list is
 * empty, which decides whether that FAB would duplicate their
 * FinanceEmptyState CTA — see each page's own FloatingActionButton
 * usage), so they're deliberately excluded here. Deep task pages
 * (new/edit/detail/quick-add itself) get no FAB at all.
 */
const FINANCE_GENERIC_FAB_ROUTES = new Set(["/finance", "/finance/reports", "/finance/net-worth"]);

function moduleOf(pathname: string): (typeof MODULE_PREFIXES)[number] | null {
  return MODULE_PREFIXES.find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ?? null;
}

export function AppShell({ children, globalHeader, financeQuickAdd }: { children: ReactNode; globalHeader: ReactNode; financeQuickAdd: ReactNode }) {
  const pathname = usePathname();
  const isTopLevel = TOP_LEVEL_ROUTES.has(pathname);
  // BottomNav (and the bottom padding that clears it) now persists across
  // an ENTIRE module's tree — every nested route under /finance, /pets,
  // /calendar, /household — not just each module's own root page. The
  // top app header ("Our Home" + avatar) stays exact-top-level-only,
  // unchanged from before.
  const inModule = moduleOf(pathname) !== null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {isTopLevel ? globalHeader : null}
      {/* The in-module bottom padding must clear BOTH the floating
          BottomNav AND, on top of it, a bottom-right FAB — plus the real
          safe-area inset, not a guessed fixed value, so an iPhone's home
          indicator never eats into it. See FloatingActionButton.tsx /
          BottomNav.tsx for the offsets this number was derived from. */}
      <main className={`mx-auto w-full max-w-xl flex-1 px-4 ${inModule ? "pb-[calc(env(safe-area-inset-bottom)+10rem)] pt-2" : "pb-8 pt-1"}`}>{children}</main>
      {inModule ? <BottomNav /> : null}
      {inModule && FINANCE_GENERIC_FAB_ROUTES.has(pathname) ? financeQuickAdd : null}
    </div>
  );
}
