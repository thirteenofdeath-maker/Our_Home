import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils/money";

import type { TransactionHistoryItem } from "../types";

const TYPE_LABEL: Record<TransactionHistoryItem["transactionType"], string> = {
  INCOME: "รายรับ",
  EXPENSE: "รายจ่าย",
  TRANSFER: "โอนเงิน",
  DEBT_PRINCIPAL: "เงินต้นหนี้/เงินยืม",
};

const ADJUSTMENT_LABEL: Record<"REFUND" | "REIMBURSEMENT", string> = {
  REFUND: "คืนเงิน",
  REIMBURSEMENT: "เบิกคืน",
};

export function TransactionHistoryList({
  items,
  currency,
}: {
  items: TransactionHistoryItem[];
  currency?: string;
}) {
  if (items.length === 0) {
    return <EmptyState title="ยังไม่มีรายการ" description="เพิ่มรายรับหรือรายจ่ายแรกของคุณ" />;
  }

  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {items.map((item) => {
        const isTransfer = item.transactionType === "TRANSFER";
        const amountClassName = item.adjustment
          ? "text-income"
          : isTransfer
            ? "text-transfer"
            : item.amount.startsWith("-")
              ? "text-expense"
              : "text-income";

        const title = item.pocketTransfer
          ? `${item.pocketTransfer.fromPocketName} → ${item.pocketTransfer.toPocketName}`
          : item.walletTransfer
            ? `${item.walletTransfer.fromWalletName} / ${item.walletTransfer.fromPocketName} → ${item.walletTransfer.toWalletName} / ${item.walletTransfer.toPocketName}`
          : item.title || item.categoryName || TYPE_LABEL[item.transactionType];

        const subtitle = item.adjustment
          ? `${ADJUSTMENT_LABEL[item.adjustment.kind]}${item.adjustment.originalTitle ? ` · ${item.adjustment.originalTitle}` : ""}`
          : item.pocketTransfer
            ? "โอนเงินระหว่างช่อง"
            : isTransfer
              ? item.amount.startsWith("-")
                ? "โอนเงินออก"
                : "โอนเงินเข้า"
              : `${TYPE_LABEL[item.transactionType]}${item.categoryName ? ` · ${item.categoryName}` : ""}`;

        const context = `${item.walletName} / ${item.pocketName}`;

        return (
          <li key={item.transactionId}>
            <Link
              href={`/finance/transactions/${item.transactionId}`}
              className={`flex items-center justify-between px-4 py-3 hover:bg-surface-muted ${item.voidedAt ? "opacity-60" : ""}`}
            >
              <div>
                <p className="text-sm font-medium">
                  {title}
                  {item.voidedAt ? <span className="ml-2 text-xs font-normal text-danger">ยกเลิกแล้ว</span> : null}
                </p>
                <p className="text-xs text-foreground-muted">
                  {subtitle} · {new Date(item.occurredAt).toLocaleDateString("th-TH")}
                </p>
                <p className="text-xs text-foreground-muted">
                  {context}{item.note ? ` · ${item.note}` : ""}{item.creatorName ? ` · ${item.creatorName}` : ""}
                </p>
              </div>
              <span className={`tabular-nums ${amountClassName}`}>
                {formatCurrency(item.pocketTransfer?.amount ?? item.amount, item.currency ?? currency ?? "THB")}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
