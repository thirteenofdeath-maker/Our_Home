import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/money";

export interface FinanceTrendPoint {
  month: string;
  income: string;
  expense: string;
}

/**
 * One currency's trend + this-month totals. The caller renders one of
 * these per currency present in `getFinanceSummary`'s `monthTotals` —
 * amounts across different currencies are never combined into a single
 * card (see docs/DOMAIN_RULES.md). The bar heights below are a ratio
 * computed with `Number()` purely to scale pixels — never rendered as a
 * money figure; every displayed amount still comes from its original
 * decimal string via `formatCurrency`, and `net` is computed by the
 * caller with exact integer-cent arithmetic (`subtractMoney`), not
 * floating point.
 */
export function FinanceTrendCard({
  currency,
  showCurrencyLabel,
  trend,
  income,
  expense,
  net,
}: {
  currency: string;
  showCurrencyLabel: boolean;
  trend: FinanceTrendPoint[];
  income: string;
  expense: string;
  net: string;
}) {
  const maxValue = Math.max(1, ...trend.flatMap((point) => [Number(point.income), Number(point.expense)]));
  const lastMonth = trend.length > 0 ? trend[trend.length - 1]!.month : null;

  return (
    <div className="rounded-[1.25rem] bg-finance-surface-strong p-4 shadow-[0_1px_2px_rgb(68_80_92_/_0.04),0_8px_20px_rgb(68_80_92_/_0.06)]">
      <p className="text-sm font-medium text-finance-muted">แนวโน้ม{showCurrencyLabel ? ` · ${currency}` : ""}</p>

      {trend.length > 0 ? (
        // The `h-40` here is the ONLY source of truth for the chart's
        // pixel height. Every percentage-height bar below needs its
        // DIRECT parent to have a definite (non-auto) height for that
        // percentage to resolve to anything at all — a bar nested
        // straight inside a plain `flex-1` column (whose own height is
        // `auto`) resolves to computed height 0 per the CSS spec, which
        // is exactly what made this chart render as a tall, visually
        // empty block on real devices despite correct underlying data.
        // `h-full` on the column makes it inherit this `h-40` (a real
        // pixel value) as ITS OWN definite height, which is what the
        // bars actually measure their percentage against.
        <div className="mt-3 flex h-40 gap-1.5" aria-hidden="true">
          {trend.map((point) => {
            const isCurrent = point.month === lastMonth;
            return (
              // Expense bar first (left), income bar second (right) within
              // each column — this must match the left-to-right order of
              // the summary row below (รายจ่ายรวม, รายรับรวม, คงเหลือ), or
              // the chart visually reads as contradicting its own numbers
              // (see FinanceTrendCard.test.ts "series ordering" guard).
              <div key={point.month} className="flex h-full flex-1 items-end gap-0.5">
                <div
                  data-series="expense"
                  className={cn("w-full rounded-t-sm", isCurrent ? "bg-finance-expense" : "bg-finance-expense/40")}
                  style={{ height: `${Math.max((Number(point.expense) / maxValue) * 100, 2)}%` }}
                />
                <div
                  data-series="income"
                  className={cn("w-full rounded-t-sm", isCurrent ? "bg-finance-income" : "bg-finance-income/40")}
                  style={{ height: `${Math.max((Number(point.income) / maxValue) * 100, 2)}%` }}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 flex h-16 items-center justify-center rounded-[1rem] bg-finance-background">
          <p className="text-xs text-finance-muted">ยังไม่มีข้อมูลแนวโน้ม</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-finance-muted">รายจ่ายรวม</p>
          <p className="truncate font-semibold tabular-nums text-finance-expense">{formatCurrency(expense, currency)}</p>
        </div>
        <div>
          <p className="text-xs text-finance-muted">รายรับรวม</p>
          <p className="truncate font-semibold tabular-nums text-finance-income">{formatCurrency(income, currency)}</p>
        </div>
        <div>
          <p className="text-xs text-finance-muted">คงเหลือ</p>
          <p className={`truncate font-semibold tabular-nums ${net.startsWith("-") ? "text-finance-expense" : "text-finance-text"}`}>{formatCurrency(net, currency)}</p>
        </div>
      </div>
    </div>
  );
}
