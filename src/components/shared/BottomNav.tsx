"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

/**
 * Wallet/Pocket/Category are Finance Hub sub-tools (see
 * docs/ARCHITECTURE.md Finance Hub section), not competing top-level
 * destinations — exported so this list itself is the regression test for
 * that (see BottomNav.test.ts) rather than something only checkable by
 * eyeballing a render.
 */
export const NAV_ITEMS = [
  { href: "/finance", label: "การเงิน" },
  { href: "/pets", label: "สัตว์เลี้ยง" },
  { href: "/calendar", label: "ปฏิทิน" },
  { href: "/household", label: "ครอบครัว" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-10 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex h-14 flex-col items-center justify-center text-xs font-medium",
                  active ? "text-primary" : "text-foreground-muted",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
