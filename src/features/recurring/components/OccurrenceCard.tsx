import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils/money";

import { formatFinanceDate, type OccurrenceSummary } from "../types";

const STATUS_LABEL: Record<OccurrenceSummary["status"], string | null> = {
  UPCOMING: null,
  POSTED: "บันทึกแล้ว",
  SKIPPED: "ข้ามแล้ว",
};

export function OccurrenceCard({ item, compact = false }: { item: OccurrenceSummary; compact?: boolean }) {
  const statusLabel = STATUS_LABEL[item.status];
  const amountClassName = item.transactionType === "EXPENSE" ? "text-expense" : "text-income";

  return (
    <Link href={`/finance/recurring/occurrences/${item.occurrenceId}`}>
      <Card className={`flex items-center justify-between ${item.status !== "UPCOMING" ? "opacity-60" : ""}`}>
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-xs text-foreground-muted">
            {formatFinanceDate(item.dueDate)}
            {statusLabel ? ` · ${statusLabel}` : ""}
            {item.status === "POSTED" && item.postedTransactionVoided ? " · รายการถูกยกเลิก" : ""}
            {!compact && item.categoryName ? ` · ${item.categoryName}` : ""}
          </p>
        </div>
        <span className={`tabular-nums ${amountClassName}`}>{item.walletCurrency ? formatCurrency(item.amount, item.walletCurrency) : item.amount}</span>
      </Card>
    </Link>
  );
}
