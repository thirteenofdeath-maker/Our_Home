import { notFound } from "next/navigation";

import { ActionButton } from "@/components/ui/ActionButton";
import { Card } from "@/components/ui/Card";
import { getBudget, getBudgetSummary } from "@/features/budgets/api";
import { restoreBudgetAction } from "@/features/budgets/actions";
import { ArchiveBudgetForm } from "@/features/budgets/components/ArchiveBudgetForm";
import { BudgetAmountForm } from "@/features/budgets/components/BudgetAmountForm";
import { budgetProgressPercent, budgetStatus } from "@/features/budgets/types";
import { financeMonthRange } from "@/features/finance/domain/finance";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency, normalizeDatabaseMoney } from "@/lib/utils/money";

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ budgetId: string }>;
}) {
  const { budgetId } = await params;
  const { supabase } = await requireUser();

  const budget = await getBudget(supabase, budgetId);
  if (!budget) notFound();

  const month = budget.period_month.slice(0, 7);
  const { start, end } = financeMonthRange(month);
  const { active, archived } = await getBudgetSummary(supabase, { periodMonth: budget.period_month, monthStart: start, monthEnd: end });
  const item = [...active, ...archived].find((i) => i.budgetId === budgetId);
  if (!item) notFound();

  const status = budgetStatus(item);
  const percent = budgetProgressPercent(item);
  const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(
    new Date(`${budget.period_month}T00:00:00+07:00`),
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm text-foreground-muted">{monthLabel}</p>
        <h1 className="text-xl font-semibold">
          {item.categoryName}
          {item.categoryArchived ? <span className="ml-2 text-sm text-foreground-muted">(หมวดหมู่ถูกเก็บถาวร)</span> : null}
        </h1>
      </header>

      {item.archivedAt ? (
        <Card className="border-danger bg-danger/10">
          <p className="font-medium text-danger">งบประมาณนี้ถูกเก็บถาวร</p>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-semibold tabular-nums">{formatCurrency(item.netSpent, item.currency)}</span>
          <span className="text-foreground-muted"> / {formatCurrency(item.budgetAmount, item.currency)}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className={`h-full ${status === "OVER" ? "bg-danger" : status === "NEAR_LIMIT" ? "bg-primary" : "bg-income"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm text-foreground-muted">
          <span>{percent.toFixed(0)}%</span>
          <span>เหลือ {formatCurrency(item.remaining, item.currency)}</span>
        </div>
      </Card>

      {!item.archivedAt ? (
        <section className="flex flex-col gap-4">
          <BudgetAmountForm budgetId={budget.id} currentAmount={normalizeDatabaseMoney(budget.amount)} />
          <ArchiveBudgetForm budgetId={budget.id} />
        </section>
      ) : (
        <ActionButton
          action={restoreBudgetAction}
          hiddenFields={{ id: budget.id }}
          label="กู้คืนงบประมาณ"
          variant="primary"
          className="w-full"
        />
      )}
    </div>
  );
}
