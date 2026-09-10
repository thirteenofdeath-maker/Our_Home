import Link from "next/link";

import { financeExpenseHref, financeIncomeHref, financeTransferHref } from "@/features/finance/domain/finance";

export function GlobalQuickAdd({ walletId }: { walletId: string | null }) {
  return (
    <Link
      aria-label="เพิ่มรายการการเงิน"
      href={walletId ? `/finance/quick-add?walletId=${walletId}` : "/wallets/new"}
      className="fixed bottom-20 right-4 z-20 flex size-14 items-center justify-center rounded-full bg-primary text-3xl leading-none text-primary-foreground shadow-lg transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span aria-hidden="true">+</span>
    </Link>
  );
}

export function QuickAddChoices({ walletId }: { walletId: string }) {
  return (
    <div className="grid gap-3">
      <Link href={financeIncomeHref(walletId)} className="flex min-h-14 items-center rounded-control border border-income/20 bg-income/10 p-4 font-medium text-income">+ รายรับ</Link>
      <Link href={financeExpenseHref(walletId)} className="flex min-h-14 items-center rounded-control border border-expense/20 bg-expense/10 p-4 font-medium text-expense">− รายจ่าย</Link>
      <Link href={financeTransferHref(walletId)} className="flex min-h-14 items-center rounded-control border border-transfer/20 bg-transfer/10 p-4 font-medium text-transfer">↔ โอนเงิน</Link>
    </div>
  );
}
