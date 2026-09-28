import Link from "next/link";

import { AppIcon } from "@/components/ui/AppIcon";
import { MonthPicker } from "@/features/calendar/components/MonthPicker";

export function financeMonthHref(
  pathname: string,
  month: string,
  query: Record<string, string>,
) {
  const params = new URLSearchParams(query);
  params.set("month", month);
  return `${pathname}?${params.toString()}`;
}

export function FinanceMonthNavigator({
  month,
  label,
  previousMonth,
  nextMonth,
  pathname,
  query = {},
  currentMonth,
}: {
  month: string;
  label: string;
  previousMonth: string;
  nextMonth: string;
  pathname: string;
  query?: Record<string, string>;
  currentMonth: string;
}) {
  return (
    <div className="rounded-[1.35rem] bg-finance-surface-strong p-1 shadow-sm">
      <nav
        aria-label="เปลี่ยนเดือน"
        className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2"
      >
        <Link
          href={financeMonthHref(pathname, previousMonth, query)}
          aria-label="เดือนก่อนหน้า"
          className="flex size-10 items-center justify-center rounded-full bg-finance-primary-soft text-finance-primary-strong"
        >
          <AppIcon name="chevron" className="size-4 rotate-180" />
        </Link>
        <MonthPicker
          month={month}
          label={label}
          pathname={pathname}
          query={query}
        />
        <Link
          href={financeMonthHref(pathname, nextMonth, query)}
          aria-label="เดือนถัดไป"
          className="flex size-10 items-center justify-center rounded-full bg-finance-primary-soft text-finance-primary-strong"
        >
          <AppIcon name="chevron" className="size-4" />
        </Link>
      </nav>
      <div className="flex justify-end pr-1">
        <Link
          href={financeMonthHref(pathname, currentMonth, query)}
          aria-current={month === currentMonth ? "date" : undefined}
          className="flex min-h-8 items-center rounded-full border border-finance-primary/35 px-3 text-xs font-medium text-finance-primary-strong"
        >
          เดือนนี้
        </Link>
      </div>
    </div>
  );
}
