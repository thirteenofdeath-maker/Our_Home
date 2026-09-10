import Link from "next/link";

import { buttonClassName } from "@/components/ui/Button";
import { getBudgetSummary } from "@/features/budgets/api";
import { BudgetCard } from "@/features/budgets/components/BudgetCard";
import { currentFinanceMonth, financeMonthRange, financeMonthToPeriodMonth, shiftFinanceMonth } from "@/features/finance/domain/finance";
import { requireUser } from "@/lib/auth/require-user";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { supabase } = await requireUser();
  const { month: rawMonth } = await searchParams;
  const month = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : currentFinanceMonth();

  const periodMonth = financeMonthToPeriodMonth(month);
  const { start, end } = financeMonthRange(month);
  const { active, archived } = await getBudgetSummary(supabase, { periodMonth, monthStart: start, monthEnd: end });

  const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(
    new Date(`${periodMonth}T00:00:00+07:00`),
  );
  const prevMonth = shiftFinanceMonth(month, -1);
  const nextMonth = shiftFinanceMonth(month, 1);

  return (
    <div className="flex flex-col gap-4">

      <div className="flex items-center justify-between">
        <Link href={`/finance/budgets?month=${prevMonth}`} className={buttonClassName("secondary", "md", "w-auto px-3")}>
          &lsaquo;
        </Link>
        <p className="font-medium">{monthLabel}</p>
        <Link href={`/finance/budgets?month=${nextMonth}`} className={buttonClassName("secondary", "md", "w-auto px-3")}>
          &rsaquo;
        </Link>
      </div>

      {active.length === 0 ? (
        <p className="py-6 text-center text-sm text-foreground-muted">ยังไม่มีงบประมาณเดือนนี้</p>
      ) : (
        <div className="flex flex-col gap-2">
          {active.map((item) => (
            <BudgetCard key={item.budgetId} item={item} />
          ))}
        </div>
      )}

      <Link href={`/finance/budgets/new?month=${month}`} className={buttonClassName("primary", "lg")}>
        + สร้างงบประมาณ
      </Link>

      {archived.length > 0 ? (
        <details className="rounded-card border border-border bg-surface p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground-muted">งบประมาณที่เก็บถาวร ({archived.length})</summary>
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
