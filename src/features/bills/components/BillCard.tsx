import Link from "next/link";

import { AppIcon } from "@/components/ui/AppIcon";
import { formatCurrency } from "@/lib/utils/money";
import type { BillSummary } from "../types";

export function BillCard({ item }: { item: BillSummary }) {
  const detail =
    item.recurrenceType === "ONE_TIME"
      ? "ครั้งเดียว"
      : item.pausedAt
        ? "หยุดชั่วคราว"
        : "ตามรอบ";
  return (
    <Link
      href={`/finance/bills/${item.billId}`}
      className="flex items-center gap-3 rounded-[1.25rem] bg-finance-surface-strong p-4 shadow-sm"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-finance-warning/15 text-finance-warning">
        <AppIcon name="calendar" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-finance-text">
          {item.name}
        </span>
        <span className="block truncate text-xs text-finance-muted">
          {detail}
          {item.walletName ? ` · ${item.walletName}` : ""}
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-finance-text">
        {formatCurrency(item.amount, item.currency)}
      </span>
    </Link>
  );
}
