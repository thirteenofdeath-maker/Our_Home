import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils/money";

import { budgetProgressPercent, budgetStatus, type BudgetSummaryItem } from "../types";

const STATUS_BAR_CLASS: Record<ReturnType<typeof budgetStatus>, string> = {
  UNDER: "bg-income",
  NEAR_LIMIT: "bg-primary",
  OVER: "bg-danger",
};

export function BudgetCard({ item, compact = false }: { item: BudgetSummaryItem; compact?: boolean }) {
  const status = budgetStatus(item);
  const percent = budgetProgressPercent(item);
  const isOver = status === "OVER";

  return (
    <Link href={`/finance/budgets/${item.budgetId}`}>
      <Card className={`flex flex-col gap-2 ${item.archivedAt ? "opacity-60" : ""}`}>
        <div className="flex items-center justify-between">
          <p className="font-medium">
            {item.categoryName}
            {item.categoryArchived ? <span className="ml-1 text-xs text-foreground-muted">(หมวดหมู่ถูกเก็บถาวร)</span> : null}
          </p>
          {!compact ? <span className="text-xs text-foreground-muted">{item.currency}</span> : null}
        </div>

        <div className="flex items-baseline justify-between text-sm">
          <span className={isOver ? "font-medium text-danger" : ""}>{formatCurrency(item.netSpent, item.currency)}</span>
          <span className="text-foreground-muted"> / {formatCurrency(item.budgetAmount, item.currency)}</span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
          <div className={`h-full ${STATUS_BAR_CLASS[status]}`} style={{ width: `${percent}%` }} />
        </div>

        {isOver ? (
          <p className="text-xs font-medium text-danger">เกินงบ {formatCurrency((Number(item.netSpent) - Number(item.budgetAmount)).toFixed(2), item.currency)}</p>
        ) : (
          <p className="text-xs text-foreground-muted">{percent.toFixed(0)}% · เหลือ {formatCurrency(item.remaining, item.currency)}</p>
        )}
      </Card>
    </Link>
  );
}
