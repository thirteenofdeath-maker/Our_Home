"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

/** Primary Finance destinations. Planning modules remain available from the
 * Overview cards, while this control stays small enough to fit one phone row. */
export const FINANCE_MODULES = [
  { href: "/finance", label: "ภาพรวม" },
  { href: "/finance/transactions", label: "ธุรกรรม" },
  { href: "/wallets", label: "กระเป๋า" },
] as const;

/** Three equal segmented tabs shared by Overview, Transactions, and Wallets. */
export function FinanceModuleTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="หน้าหลักการเงิน">
      <ul className="grid h-12 grid-cols-3 items-center rounded-[1.15rem] bg-finance-surface-strong p-1 shadow-sm">
        {FINANCE_MODULES.map((financeModule) => {
          const active =
            pathname === financeModule.href ||
            (financeModule.href === "/wallets" &&
              pathname.startsWith("/wallets/"));
          return (
            <li key={financeModule.href} className="min-w-0">
              <Link
                href={financeModule.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 min-w-0 items-center justify-center whitespace-nowrap rounded-[0.9rem] px-2 text-sm font-semibold transition-colors",
                  active
                    ? "bg-finance-primary-soft text-finance-primary-strong shadow-sm"
                    : "text-finance-muted",
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
