import Link from "next/link";

import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";
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

function isTransfer(item: TransactionHistoryItem): boolean {
  return item.transactionType === "TRANSFER" || Boolean(item.pocketTransfer) || Boolean(item.walletTransfer);
}

/**
 * Icon + soft color pairing: income/adjustment = soft green, expense =
 * soft coral, transfer = soft blue — a voided row is always muted
 * regardless of what it originally was (see docs/DOMAIN_RULES.md Phase
 * B), never hidden or relabeled otherwise.
 */
function rowVisual(item: TransactionHistoryItem): { icon: AppIconName; className: string } {
  if (item.voidedAt) return { icon: isTransfer(item) ? "transfer" : item.amount.startsWith("-") ? "expense" : "income", className: "bg-finance-muted/15 text-finance-muted" };
  if (item.adjustment) return { icon: "income", className: "bg-finance-income/15 text-finance-income" };
  if (isTransfer(item)) return { icon: "transfer", className: "bg-finance-transfer/15 text-finance-transfer" };
  return item.amount.startsWith("-")
    ? { icon: "expense", className: "bg-finance-expense/15 text-finance-expense" }
    : { icon: "income", className: "bg-finance-income/15 text-finance-income" };
}

/**
 * `dashboard` — light-touch, whitespace-separated rows for the Finance
 * Overview's recent-activity preview (no bordered box).
 * `full` — the bordered/divided list used for search results, called
 * once per date group by /finance/transactions.
 * `wallet` — like `full`, but omits the wallet name from the context
 * line (redundant — the whole list is already scoped to one wallet).
 */
export function TransactionHistoryList({
  items,
  currency,
  variant = "full",
}: {
  items: TransactionHistoryItem[];
  currency?: string;
  variant?: "dashboard" | "full" | "wallet";
}) {
  if (items.length === 0) {
    return <EmptyState title="ยังไม่มีรายการ" description="เพิ่มรายรับหรือรายจ่ายแรกของคุณ" />;
  }

  return (
    <ul
      className={cn(
        "flex flex-col",
        variant === "dashboard" ? "gap-1" : "divide-y divide-finance-primary-soft/60 overflow-hidden rounded-[1.25rem] bg-finance-surface-strong",
      )}
    >
      {items.map((item) => {
        const transfer = isTransfer(item);
        const amountClassName = item.voidedAt
          ? "text-finance-muted"
          : item.adjustment
            ? "text-finance-income"
            : transfer
              ? "text-finance-transfer"
              : item.amount.startsWith("-")
                ? "text-finance-expense"
                : "text-finance-income";

        // Whether the title fell back to the category name (no title/note
        // of its own, not a transfer) — if so, the subtitle below must
        // not repeat that same category name again right underneath it.
        const usingCategoryAsTitle = !transfer && !item.title && Boolean(item.categoryName);
        const title = item.pocketTransfer
          ? `${item.pocketTransfer.fromPocketName} → ${item.pocketTransfer.toPocketName}`
          : item.walletTransfer
            ? `${item.walletTransfer.fromWalletName} / ${item.walletTransfer.fromPocketName} → ${item.walletTransfer.toWalletName} / ${item.walletTransfer.toPocketName}`
            : item.title || item.categoryName || TYPE_LABEL[item.transactionType];

        const subtitle = item.adjustment
          ? `${ADJUSTMENT_LABEL[item.adjustment.kind]}${item.adjustment.originalTitle ? ` · ${item.adjustment.originalTitle}` : ""}`
          : item.pocketTransfer
            ? "โอนเงินระหว่างช่อง"
            : transfer
              ? item.amount.startsWith("-")
                ? "โอนเงินออก"
                : "โอนเงินเข้า"
              : usingCategoryAsTitle
                ? TYPE_LABEL[item.transactionType]
                : `${TYPE_LABEL[item.transactionType]}${item.categoryName ? ` · ${item.categoryName}` : ""}`;

        const context = variant === "wallet" ? item.pocketName : `${item.walletName} / ${item.pocketName}`;
        const visual = rowVisual(item);
        // "full" is always rendered once per date group (see
        // groupTransactionsByDate) so the group's own heading already
        // carries the date — showing only the time avoids repeating it on
        // every row. dashboard/wallet mix multiple days in one list, so
        // they keep the date too.
        const occurred = new Date(item.occurredAt);
        const timeLabel = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }).format(occurred);
        const whenLabel = variant === "full" ? timeLabel : `${occurred.toLocaleDateString("th-TH")} · ${timeLabel}`;
        // Dashboard rows are a compact recent-activity preview — a bare
        // timestamp on every row adds little there and pushes the row
        // taller for no real benefit, so line 3 only appears when there
        // is a note or creator actually worth showing.
        const showThirdLine = variant !== "dashboard" || Boolean(item.note) || Boolean(item.creatorName);

        return (
          <li key={item.transactionId}>
            <Link
              href={`/finance/transactions/${item.transactionId}`}
              className={cn(
                "flex items-center gap-3 hover:bg-finance-primary-soft/30",
                variant === "dashboard" ? "rounded-[1rem] px-2 py-2" : "px-4 py-3",
                item.voidedAt ? "opacity-60" : "",
              )}
            >
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", visual.className)}>
                <AppIcon name={visual.icon} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-finance-text">
                  {title}
                  {item.voidedAt ? <span className="ml-2 text-xs font-normal text-finance-expense">ยกเลิกแล้ว</span> : null}
                </span>
                <span className="block truncate text-xs text-finance-muted">
                  {context}
                  {subtitle ? ` · ${subtitle}` : ""}
                </span>
                {showThirdLine ? (
                  <span className="block truncate text-xs text-finance-muted">
                    {whenLabel}
                    {item.note ? ` · ${item.note}` : ""}
                    {item.creatorName ? ` · ${item.creatorName}` : ""}
                  </span>
                ) : null}
              </span>
              <span className={cn("shrink-0 tabular-nums text-sm font-semibold", amountClassName)}>
                {formatCurrency(item.pocketTransfer?.amount ?? item.amount, item.currency ?? currency ?? "THB")}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
