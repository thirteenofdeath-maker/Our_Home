"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import {
  appSectionForPath,
  type AppSection,
} from "@/lib/navigation/app-section";

/**
 * Pure navigation, nothing else — the "+" quick-add action lives in a
 * separate FloatingActionButton layer now (see FloatingActionButton.tsx
 * and each module's own FAB usage), never a cell inside this grid. Exactly
 * these five real destinations, always rendered as links, on every module
 * (including deep/nested routes within one, AND every Finance-owned
 * secondary route family like /wallets or /categories — see AppShell.tsx
 * and app-section.ts, the shared source of truth both read).
 */
export const NAV_ITEMS = [
  { href: "/", label: "วันนี้", icon: "home", section: "home" },
  { href: "/finance", label: "การเงิน", icon: "finance", section: "finance" },
  { href: "/calendar", label: "แผนงาน", icon: "calendar", section: "calendar" },
  { href: "/pets", label: "สัตว์เลี้ยง", icon: "pets", section: "pets" },
  {
    href: "/household",
    label: "ครอบครัว",
    icon: "household",
    section: "household",
  },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  icon: AppIconName;
  section: AppSection;
}>;

/**
 * One floating-capsule architecture for every module — fixed above the
 * safe area, inset from the screen edges, rounded, elevated shadow, five
 * equal columns. Only the color tokens differ: Finance routes get the
 * Finance V2 blue-gray accent (via `.finance-scope`), every other module
 * keeps the app's default primary accent — never a structural difference
 * (no more "Finance floats, everyone else is an edge-to-edge bar").
 */
export function BottomNav() {
  const pathname = usePathname();
  const section = appSectionForPath(pathname);
  const isFinance = section === "finance";

  function renderItem(item: (typeof NAV_ITEMS)[number]) {
    const active = section === item.section;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex h-[3.65rem] flex-col items-center justify-center gap-0.5 rounded-[1.05rem] text-[10px] font-medium transition-colors",
            active
              ? isFinance
                ? "bg-finance-primary-soft text-finance-primary-strong"
                : "bg-primary-soft text-primary"
              : isFinance
                ? "text-finance-muted"
                : "text-foreground-muted",
          )}
        >
          <AppIcon name={item.icon as AppIconName} className="size-5" />
          <span>{item.label}</span>
        </Link>
      </li>
    );
  }

  return (
    <nav
      className={cn(
        "fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-30",
        isFinance && "finance-scope",
      )}
    >
      <ul
        className={cn(
          "mx-auto grid max-w-xl grid-cols-5 items-center gap-1 overflow-hidden rounded-[1.75rem] border border-white/70 px-1.5 py-1.5 shadow-[0_8px_28px_rgb(57_65_61_/_0.16)]",
          isFinance ? "bg-finance-surface-strong" : "bg-surface",
        )}
      >
        {NAV_ITEMS.map(renderItem)}
      </ul>
    </nav>
  );
}
