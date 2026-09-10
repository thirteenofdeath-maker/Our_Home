"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";

/**
 * Wallet/Pocket/Category are Finance Hub sub-tools (see
 * docs/ARCHITECTURE.md Finance Hub section), not competing top-level
 * destinations — exported so this list itself is the regression test for
 * that (see BottomNav.test.ts) rather than something only checkable by
 * eyeballing a render.
 */
export const NAV_ITEMS = [
  { href: "/finance", label: "การเงิน", icon: "finance" },
  { href: "/pets", label: "สัตว์เลี้ยง", icon: "pets" },
  { href: "/calendar", label: "ปฏิทิน", icon: "calendar" },
  { href: "/household", label: "ครอบครัว", icon: "household" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 bg-surface/95 px-2 pt-1 shadow-[0_-8px_24px_rgb(57_65_61_/_0.06)] backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 rounded-control text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-foreground-muted",
                )}
              >
                <AppIcon name={item.icon as AppIconName} className="size-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
