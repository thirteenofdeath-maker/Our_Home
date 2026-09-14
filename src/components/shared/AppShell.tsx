"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BottomNav } from "./BottomNav";
import { appSectionForPath } from "@/lib/navigation/app-section";

const TOP_LEVEL_ROUTES = new Set(["/finance", "/pets", "/calendar", "/household"]);

export function AppShell({ children, globalHeader }: { children: ReactNode; globalHeader: ReactNode }) {
  const pathname = usePathname();
  const isTopLevel = TOP_LEVEL_ROUTES.has(pathname);
  // BottomNav now persists across the ENTIRE authenticated app — every
  // route under (app), at any depth, in any section — with exactly one
  // exception: Onboarding, which has nothing yet to navigate between.
  // `appSectionForPath` is the single shared classifier BottomNav itself
  // also reads (for active-tab/tone), so the two can never disagree about
  // which routes count as "in the app". The top app header ("Our Home" +
  // avatar) stays exact-top-level-only, a deliberately separate concern
  // from BottomNav persistence — see docs/ARCHITECTURE.md.
  const showBottomNav = appSectionForPath(pathname) !== "onboarding";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {isTopLevel ? globalHeader : null}
      {/* Bottom clearance includes the floating navigation and safe area. */}
      <main className={`mx-auto w-full max-w-xl flex-1 px-4 ${showBottomNav ? "pb-[calc(env(safe-area-inset-bottom)+10rem)] pt-2" : "pb-8 pt-1"}`}>{children}</main>
      {showBottomNav ? <BottomNav /> : null}
    </div>
  );
}
