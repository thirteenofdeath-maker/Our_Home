"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";

/**
 * Wallet/Pocket/Category are Finance Hub sub-tools (see
 * docs/ARCHITECTURE.md Finance Hub section), not competing top-level
 * destinations — exported so this list itself is the regression test for
 * that (see BottomNav.test.ts) rather than something only checkable by
 * eyeballing a render. Exactly these four real destinations always
 * render as links, on every top-level page — `centerAction` (see below)
 * is a fifth CELL only on /finance, never a fifth destination.
 */
export const NAV_ITEMS = [
  { href: "/finance", label: "การเงิน", icon: "finance" },
  { href: "/pets", label: "สัตว์เลี้ยง", icon: "pets" },
  { href: "/calendar", label: "ปฏิทิน", icon: "calendar" },
  { href: "/household", label: "ครอบครัว", icon: "household" },
] as const;

/**
 * `centerAction` (GlobalQuickAdd) only ever occupies a real center GRID
 * CELL between the two left and two right nav links — never a `fixed`/
 * overlapping element and never a fifth nav destination. It is only
 * actually rendered when the current route is /finance; on every other
 * top-level page (/pets, /calendar, /household) this component falls
 * back to the plain four-column layout regardless of whether a caller
 * passes `centerAction` — so those pages are never at risk of a stray
 * center action just because the value happened to be supplied.
 *
 * Visual note: on /finance the whole bar becomes a floating rounded
 * capsule in the Finance V2 palette; every other top-level page keeps
 * the original edge-to-edge bar untouched — this is deliberately
 * pathname-aware styling, not a global BottomNav redesign. `finance-scope`
 * is applied to <nav> itself (for the --finance-* variables), never
 * combined with a background or text-color utility on that SAME
 * element — the pill's own visible background lives on the <ul> child
 * instead, so it can
 * never lose a cascade fight against `.finance-scope`'s own unlayered
 * background/color declaration (see globals.css).
 */
export function BottomNav({ centerAction }: { centerAction?: ReactNode }) {
  const pathname = usePathname();
  const isFinance = pathname === "/finance";
  const showCenterAction = isFinance && Boolean(centerAction);
  const [left, right] = [NAV_ITEMS.slice(0, 2), NAV_ITEMS.slice(2)];

  function renderItem(item: (typeof NAV_ITEMS)[number]) {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className={cn(
            "flex h-14 flex-col items-center justify-center gap-0.5 rounded-control text-[10px] font-medium transition-colors",
            active ? (isFinance ? "text-finance-primary-strong" : "text-primary") : isFinance ? "text-finance-muted" : "text-foreground-muted",
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
        "fixed z-10",
        isFinance ? "finance-scope inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]" : "inset-x-0 bottom-0 pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul
        className={cn(
          "mx-auto grid max-w-xl items-center",
          isFinance
            ? "rounded-[2rem] bg-finance-surface-strong px-2 shadow-[0_8px_28px_rgb(68_80_92_/_0.18)]"
            : "bg-surface/95 px-2 pt-1 shadow-[0_-8px_24px_rgb(57_65_61_/_0.06)] backdrop-blur",
          showCenterAction ? "grid-cols-[1fr_1fr_4rem_1fr_1fr]" : "grid-cols-4",
        )}
      >
        {left.map(renderItem)}
        {showCenterAction ? (
          <li className="flex items-center justify-center">
            <div className="-mt-6">{centerAction}</div>
          </li>
        ) : null}
        {right.map(renderItem)}
      </ul>
    </nav>
  );
}
