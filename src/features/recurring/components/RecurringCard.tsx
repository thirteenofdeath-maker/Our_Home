import Link from "next/link";

import { Card } from "@/components/ui/Card";

import { frequencyLabel, type RecurringSummary } from "../types";

const TYPE_LABEL: Record<"INCOME" | "EXPENSE", string> = { INCOME: "รายรับ", EXPENSE: "รายจ่าย" };

export function RecurringCard({ item }: { item: RecurringSummary }) {
  const statusLabel = item.archivedAt ? "เก็บถาวรแล้ว" : item.pausedAt ? "หยุดชั่วคราว" : null;

  return (
    <Link href={`/finance/recurring/${item.recurringId}`}>
      <Card className={`flex items-center justify-between ${item.archivedAt || item.pausedAt ? "opacity-60" : ""}`}>
        <div>
          <p className="font-medium">
            {item.name}
            {statusLabel ? <span className="ml-1 text-xs text-foreground-muted">({statusLabel})</span> : null}
          </p>
          <p className="text-xs text-foreground-muted">
            {TYPE_LABEL[item.transactionType]} · {frequencyLabel(item.frequency, item.intervalCount)}
            {item.categoryName ? ` · ${item.categoryName}` : ""}
            {item.walletName ? ` · ${item.walletName}` : ""}
          </p>
        </div>
        {/* No stored currency on a rule until it's tied to a real posted transaction — plain number, not formatted currency (same reasoning as TemplateCard). */}
        <span className={`tabular-nums ${item.transactionType === "EXPENSE" ? "text-expense" : "text-income"}`}>{item.amount}</span>
      </Card>
    </Link>
  );
}
