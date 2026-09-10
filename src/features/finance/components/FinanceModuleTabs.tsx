"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

/**
 * Horizontal module navigation for the redesigned Finance area (Phase 1
 * of the "soft finance dashboard" direction). Purely navigational — it
 * links to each module's EXISTING route and renders no data of its own,
 * so it never needs a query and never risks going stale relative to the
 * destination page. Bills and Recurring intentionally have no tab here
 * (see FinanceModuleTabs.test.ts) — they surface as compact "upcoming"
 * shortcuts on the Overview instead, not as a full module.
 */
export const FINANCE_MODULES = [
  { href: "/finance", label: "ภาพรวม" },
  { href: "/finance/reports", label: "รายงาน" },
  { href: "/finance/budgets", label: "งบประมาณ" },
  { href: "/finance/installments", label: "ผ่อนชำระ" },
  { href: "/finance/debts", label: "ยืม-ให้ยืม" },
  { href: "/finance/goals", label: "ออมเงิน" },
  { href: "/finance/net-worth", label: "มูลค่าสุทธิ" },
] as const;

/**
 * A single rounded rail (one `finance-surface-strong` container), not a
 * row of separate floating pills — only the ACTIVE tab gets its own
 * soft pill inside the rail; inactive tabs sit transparent against the
 * rail's own background (see FinanceModuleTabs.test.ts for the exact
 * structural assertions this depends on).
 */
export function FinanceModuleTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="โมดูลการเงิน" className="rounded-[1.75rem] bg-finance-surface-strong shadow-[0_1px_2px_rgb(68_80_92_/_0.04),0_6px_16px_rgb(68_80_92_/_0.06)]">
      <ul className="flex h-14 items-center gap-1 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FINANCE_MODULES.map((financeModule) => {
          const active = pathname === financeModule.href;
          return (
            <li key={financeModule.href} className="shrink-0">
              <Link
                href={financeModule.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors",
                  active ? "bg-finance-primary-soft text-finance-primary-strong" : "bg-transparent text-finance-muted",
                )}
              >
                {financeModule.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
