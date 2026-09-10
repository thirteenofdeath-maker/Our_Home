"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BottomNav } from "./BottomNav";

const TOP_LEVEL_ROUTES = new Set(["/finance", "/pets", "/calendar", "/household"]);

export function AppShell({ children, globalHeader, financeQuickAdd }: { children: ReactNode; globalHeader: ReactNode; financeQuickAdd: ReactNode }) {
  const pathname = usePathname();
  const isTopLevel = TOP_LEVEL_ROUTES.has(pathname);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {isTopLevel ? globalHeader : null}
      <main className={`mx-auto w-full max-w-xl flex-1 px-4 ${isTopLevel ? "pb-36 pt-2" : "pb-8 pt-1"}`}>{children}</main>
      {/* BottomNav itself decides whether centerAction actually renders
          (only on /finance) — see BottomNav.tsx. Passing it unconditionally
          here keeps that single decision in one place. */}
      {isTopLevel ? <BottomNav centerAction={financeQuickAdd} /> : null}
    </div>
  );
}
