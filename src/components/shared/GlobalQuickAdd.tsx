import Link from "next/link";

import { financeExpenseHref, financeIncomeHref, financeTransferHref } from "@/features/finance/domain/finance";
import { AppIcon } from "@/components/ui/AppIcon";

export function GlobalQuickAdd({ walletId }: { walletId: string | null }) {
  return (
    <Link
      aria-label="เพิ่มรายการการเงิน"
      href={walletId ? `/finance/quick-add?walletId=${walletId}` : "/wallets/new"}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+2.5rem)] left-1/2 z-20 flex size-14 -translate-x-1/2 items-center justify-center rounded-full border-4 border-surface bg-primary text-primary-foreground shadow-[0_8px_24px_rgb(57_65_61_/_0.28)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <AppIcon name="plus" />
    </Link>
  );
}

export function QuickAddChoices({ walletId }: { walletId: string }) {
  return (
    <div className="grid gap-3">
      <Link href={financeIncomeHref(walletId)} className="flex min-h-20 items-center gap-3 rounded-card bg-surface p-4 font-medium text-foreground shadow-card"><span className="flex size-11 items-center justify-center rounded-full bg-income/15 text-income"><AppIcon name="income" /></span><span className="flex-1">รายรับ</span><AppIcon name="chevron" className="size-4 text-foreground-muted" /></Link>
      <Link href={financeExpenseHref(walletId)} className="flex min-h-20 items-center gap-3 rounded-card bg-surface p-4 font-medium text-foreground shadow-card"><span className="flex size-11 items-center justify-center rounded-full bg-expense/15 text-expense"><AppIcon name="expense" /></span><span className="flex-1">รายจ่าย</span><AppIcon name="chevron" className="size-4 text-foreground-muted" /></Link>
      <Link href={financeTransferHref(walletId)} className="flex min-h-20 items-center gap-3 rounded-card bg-surface p-4 font-medium text-foreground shadow-card"><span className="flex size-11 items-center justify-center rounded-full bg-secondary text-transfer"><AppIcon name="transfer" /></span><span className="flex-1">โอนเงิน</span><AppIcon name="chevron" className="size-4 text-foreground-muted" /></Link>
    </div>
  );
}
