import Link from "next/link";

import { AppIcon } from "@/components/ui/AppIcon";
import { formatFinanceDate } from "@/features/recurring/types";
import { formatCurrency } from "@/lib/utils/money";
import { billStatusLabel } from "../domain";
import type { BillOccurrenceSummary } from "../types";

export function BillOccurrenceCard({
  item,
  compact = false,
}: {
  item: BillOccurrenceSummary;
  compact?: boolean;
}) {
  const urgent =
    item.displayStatus === "OVERDUE" || item.displayStatus === "DUE";
  return (
    <Link
      href={`/finance/bills/occurrences/${item.occurrenceId}`}
      className="flex items-center gap-3 rounded-[1.25rem] bg-finance-surface-strong p-4 shadow-sm"
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${urgent ? "bg-finance-expense/15 text-finance-expense" : "bg-finance-primary-soft text-finance-primary-strong"}`}
      >
        <AppIcon name="calendar" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-finance-text">
          {item.name}
        </span>
        <span
          className={`block truncate text-xs ${item.displayStatus === "OVERDUE" ? "text-finance-expense" : "text-finance-muted"}`}
        >
          {billStatusLabel[item.displayStatus]} ·{" "}
          {formatFinanceDate(item.dueDate)}
          {item.paymentVoided ? " · ยกเลิกการชำระ" : ""}
        </span>
      </span>
      <span
        className={`${compact ? "text-sm" : "font-semibold"} shrink-0 tabular-nums text-finance-text`}
      >
        {formatCurrency(item.expectedAmount, item.currency)}
      </span>
    </Link>
  );
}
