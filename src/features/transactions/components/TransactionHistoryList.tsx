import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils/money";

import type { TransactionHistoryItem } from "../types";

const TYPE_LABEL: Record<TransactionHistoryItem["transactionType"], string> = {
  INCOME: "รายรับ",
  EXPENSE: "รายจ่าย",
  TRANSFER: "โอนเงิน",
};

export function TransactionHistoryList({
  items,
  currency,
}: {
  items: TransactionHistoryItem[];
  currency: string;
}) {
  if (items.length === 0) {
    return <EmptyState title="ยังไม่มีรายการ" description="เพิ่มรายรับหรือรายจ่ายแรกของคุณ" />;
  }

  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {items.map((item) => {
        const isTransfer = item.transactionType === "TRANSFER";
        const amountClassName = isTransfer
          ? "text-transfer"
          : item.amount.startsWith("-")
            ? "text-expense"
            : "text-income";

        const title = item.pocketTransfer
          ? `${item.pocketTransfer.fromPocketName} → ${item.pocketTransfer.toPocketName}`
          : item.title || item.categoryName || TYPE_LABEL[item.transactionType];

        const subtitle = item.pocketTransfer
          ? "โอนเงินระหว่างช่อง"
          : isTransfer
            ? item.amount.startsWith("-")
              ? "โอนเงินออก"
              : "โอนเงินเข้า"
            : `${TYPE_LABEL[item.transactionType]}${item.categoryName ? ` · ${item.categoryName}` : ""}`;

        return (
          <li key={item.transactionId} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-foreground-muted">
                {subtitle} · {new Date(item.occurredAt).toLocaleDateString("th-TH")}
              </p>
            </div>
            <span className={`tabular-nums ${amountClassName}`}>
              {formatCurrency(item.pocketTransfer?.amount ?? item.amount, currency)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
