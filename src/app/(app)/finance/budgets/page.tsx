import Link from "next/link";

import { AppIcon } from "@/components/ui/AppIcon";
import { getBudgetSummary } from "@/features/budgets/api";
import { AddBudgetFab } from "@/features/budgets/components/AddBudgetFab";
import { BudgetCard } from "@/features/budgets/components/BudgetCard";
import { FinanceEmptyState } from "@/features/finance/components/FinanceEmptyState";
import {
  currentFinanceMonth,
  financeMonthRange,
  financeMonthToPeriodMonth,
  shiftFinanceMonth,
} from "@/features/finance/domain/finance";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency, sumMoney } from "@/lib/utils/money";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { supabase } = await requireUser();
  const { month: rawMonth } = await searchParams;
  const month =
    rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)
      ? rawMonth
      : currentFinanceMonth();

  const periodMonth = financeMonthToPeriodMonth(month);
  const { start, end } = financeMonthRange(month);
  const { active, archived } = await getBudgetSummary(supabase, {
    periodMonth,
    monthStart: start,
    monthEnd: end,
  });

  const monthLabel = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${periodMonth}T00:00:00+07:00`));
  const prevMonth = shiftFinanceMonth(month, -1);
  const nextMonth = shiftFinanceMonth(month, 1);
  const totals = [...new Set(active.map((item) => item.currency))].map(
    (currency) => ({
      currency,
      budget: sumMoney(
        active
          .filter((item) => item.currency === currency)
          .map((item) => item.budgetAmount),
      ),
      spent: sumMoney(
        active
          .filter((item) => item.currency === currency)
          .map((item) => item.netSpent),
      ),
      remaining: sumMoney(
        active
          .filter((item) => item.currency === currency)
          .map((item) => item.remaining),
      ),
    }),
  );

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between rounded-full bg-finance-surface-strong p-1 shadow-sm">
        <Link
          href={`/finance/budgets?month=${prevMonth}`}
          aria-label="เดือนก่อนหน้า"
          className="flex size-9 items-center justify-center rounded-full text-finance-text"
        >
          <AppIcon name="chevron" className="size-4 rotate-180" />
        </Link>
        <p className="font-medium text-finance-text">{monthLabel}</p>
        <Link
          href={`/finance/budgets?month=${nextMonth}`}
          aria-label="เดือนถัดไป"
          className="flex size-9 items-center justify-center rounded-full text-finance-text"
        >
          <AppIcon name="chevron" className="size-4" />
        </Link>
      </div>

      <section className="rounded-[1.6rem] bg-[linear-gradient(135deg,#fff1d9,#f5eadc)] p-5 shadow-card">
        <p className="text-sm font-medium text-finance-muted">
          งบประมาณคงเหลือ
        </p>
        {totals.length ? (
          totals.map((total) => (
            <div key={total.currency} className="mt-1">
              <p className="text-3xl font-bold tabular-nums text-finance-text">
                {formatCurrency(total.remaining, total.currency)}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl bg-white/70 p-3">
                  <p className="text-xs text-finance-muted">ตั้งไว้</p>
                  <p className="font-semibold tabular-nums text-finance-text">
                    {formatCurrency(total.budget, total.currency)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/70 p-3">
                  <p className="text-xs text-finance-muted">ใช้แล้ว</p>
                  <p className="font-semibold tabular-nums text-finance-expense">
                    {formatCurrency(total.spent, total.currency)}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="mt-1 text-3xl font-bold text-finance-text">฿0.00</p>
        )}
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-finance-text">
          งบตามหมวดหมู่
        </h2>
        <span className="text-sm text-finance-muted">
          {active.length} รายการ
        </span>
      </div>

      {/* One creation affordance at a time: when the list is empty,
          FinanceEmptyState below renders its own CTA, so this FAB is
          hidden rather than offering the same action twice. */}
      {active.length > 0 ? <AddBudgetFab periodMonth={periodMonth} /> : null}

      {active.length === 0 ? (
        <FinanceEmptyState
          icon="finance"
          title="ยังไม่มีงบประมาณ"
          description="ตั้งงบประมาณรายเดือนตามหมวดหมู่เพื่อติดตามการใช้จ่าย"
          action={<AddBudgetFab periodMonth={periodMonth} asEmptyStateCta />}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {active.map((item) => (
            <BudgetCard key={item.budgetId} item={item} />
          ))}
        </div>
      )}

      {archived.length > 0 ? (
        <details className="rounded-[1.25rem] bg-finance-surface-strong px-4 py-2 shadow-sm">
          <summary className="cursor-pointer text-sm font-medium text-finance-muted">
            งบประมาณที่เก็บถาวร ({archived.length})
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {archived.map((item) => (
              <BudgetCard key={item.budgetId} item={item} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
