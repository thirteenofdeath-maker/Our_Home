import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { formatCurrency, subtractMoney } from "@/lib/utils/money";

import { budgetProgressPercent, budgetStatus, type BudgetSummaryItem } from "../types";

const STATUS_BAR_CLASS: Record<ReturnType<typeof budgetStatus>, string> = {
  UNDER: "bg-income",
  NEAR_LIMIT: "bg-primary",
  OVER: "bg-danger",
};

/**
 * `compact` (used on the Phase 1 /finance overview — visually approved,
 * left byte-for-byte unchanged) vs the richer full card used on
 * /finance/budgets (Phase 2): a period badge and a slightly bolder
 * progress bar. Both share the same underlying numbers/status logic.
 */
export function BudgetCard({ item, compact = false }: { item: BudgetSummaryItem; compact?: boolean }) {
  const status = budgetStatus(item);
  const percent = budgetProgressPercent(item);
  const isOver = status === "OVER";
  const periodLabel = compact
    ? null
    : new Intl.DateTimeFormat("th-TH", { month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(`${item.periodMonth}T00:00:00+07:00`));

  return (
    <Link href={`/finance/budgets/${item.budgetId}`}>
      <Card className={`flex flex-col gap-2 ${item.archivedAt ? "opacity-60" : ""}`}>
        <div className="flex items-center justify-between">
          <p className="font-medium">
            {item.categoryName}
            {item.categoryArchived ? <span className="ml-1 text-xs text-foreground-muted">(หมวดหมู่ถูกเก็บถาวร)</span> : null}
          </p>
          {!compact ? (
            periodLabel ? (
              <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-foreground-muted">{periodLabel}</span>
            ) : (
              <span className="text-xs text-foreground-muted">{item.currency}</span>
            )
          ) : null}
        </div>

        <div className="flex items-baseline justify-between text-sm">
          <span className={isOver ? "font-medium text-danger" : ""}>{formatCurrency(item.netSpent, item.currency)}</span>
          <span className="text-foreground-muted"> / {formatCurrency(item.budgetAmount, item.currency)}</span>
        </div>

        <div className={`w-full overflow-hidden rounded-full bg-surface-muted ${compact ? "h-2" : "h-2.5"}`}>
          <div className={`h-full ${STATUS_BAR_CLASS[status]}`} style={{ width: `${percent}%` }} />
        </div>

        {isOver ? (
          // Never displayed text is never JS-floating-point math — exact
          // integer-cent subtraction from the two already-authoritative
          // decimal strings this card already has (see docs/DOMAIN_RULES.md).
          <p className="text-xs font-medium text-danger">เกินงบ {formatCurrency(subtractMoney(item.netSpent, item.budgetAmount), item.currency)}</p>
        ) : (
          <p className="text-xs text-foreground-muted">{percent.toFixed(0)}% · เหลือ {formatCurrency(item.remaining, item.currency)}</p>
        )}
      </Card>
    </Link>
  );
}
