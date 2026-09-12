import Link from "next/link";

import { cn } from "@/lib/utils/cn";

/**
 * Shared second-level segmented control for Finance V2 module pages
 * (Reports' หมวดหมู่/เดือน/เปรียบเทียบ, Installments' กำลังผ่อน/ผ่อนสำเร็จ,
 * Debts' ยืมเงิน/ให้ยืมเงิน, Goals' กำลังออม/สำเร็จ, ...). Purely a set of
 * real links carrying the active state via `?`-query params the page
 * itself defines and reads — never client state, so it works without JS
 * and is trivially bookmarkable/shareable.
 */
export function FinanceSegmentedControl({
  options,
  activeValue,
  ariaLabel,
}: {
  options: Array<{ value: string; label: string; href: string }>;
  activeValue: string;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-1 rounded-full bg-finance-surface-strong p-1">
      {options.map((option) => {
        const active = option.value === activeValue;
        return (
          <Link
            key={option.value}
            href={option.href}
            role="tab"
            aria-selected={active}
            className={cn(
              "flex h-11 flex-1 items-center justify-center whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors",
              active ? "bg-finance-primary-soft text-finance-primary-strong" : "text-finance-muted",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
