"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

export const FINANCE_MODULES = [
  { href: "/finance", label: "ภาพรวม" },
  { href: "/finance/transactions", label: "ธุรกรรม" },
  { href: "/wallets", label: "กระเป๋า" },
  { href: "/finance/budgets", label: "งบประมาณ" },
  { href: "/finance/goals", label: "เป้าหมาย" },
  { href: "/finance/bills", label: "บิล" },
  { href: "/finance/debts", label: "หนี้สิน" },
  { href: "/finance/installments", label: "ผ่อนชำระ" },
  { href: "/finance/recurring", label: "รายการประจำ" },
  { href: "/finance/templates", label: "รายการต้นแบบ" },
  { href: "/finance/reports", label: "รายงาน" },
  { href: "/finance/insights", label: "ข้อมูลเชิงลึก" },
  { href: "/finance/net-worth", label: "ทรัพย์สินสุทธิ" },
  { href: "/categories", label: "หมวดหมู่" },
  { href: "/finance/tags", label: "แท็ก" },
  { href: "/finance/import", label: "นำเข้า" },
  { href: "/finance/export", label: "ส่งออก" },
] as const;

/** All Finance modules share the same horizontally scrollable navigation. */
export function FinanceModuleTabs() {
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !active) return;
    const container = list.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.left < container.left || item.right > container.right) {
      list.scrollLeft +=
        item.left - container.left - (container.width - item.width) / 2;
    }
  }, [pathname]);

  return (
    <nav aria-label="หมวดการเงิน" className="shrink-0">
      <ul
        ref={listRef}
        className="flex min-w-0 gap-1 overflow-x-auto items-center rounded-[1.15rem] bg-finance-surface-strong p-1 shadow-sm"
      >
        {FINANCE_MODULES.map((financeModule) => {
          const active =
            pathname === financeModule.href ||
            (financeModule.href !== "/finance" &&
              pathname.startsWith(`${financeModule.href}/`));
          return (
            <li key={financeModule.href} className="shrink-0">
              <Link
                href={financeModule.href}
                prefetch={true}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 min-w-0 items-center justify-center whitespace-nowrap rounded-[0.9rem] px-4 text-sm font-semibold transition-colors",
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
