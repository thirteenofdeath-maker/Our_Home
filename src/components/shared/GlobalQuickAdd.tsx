import Link from "next/link";

import { financeExpenseHref, financeIncomeHref, financeTransferHref } from "@/features/finance/domain/finance";
import { AppIcon } from "@/components/ui/AppIcon";

/**
 * Rendered by BottomNav as a genuine center grid cell (see BottomNav.tsx)
 * — not `fixed`/floating and not overlapping the four real nav
 * destinations, so no z-index trick is needed to keep it clear of their
 * labels. Raised above the bar visually via a negative margin applied by
 * the parent grid cell, not by this component itself. Only ever actually
 * shown on /finance (see BottomNav's `showCenterAction`), inside its
 * `finance-scope` <nav> — so the Finance V2 blue-gray palette below
 * always has its --finance-* variables in scope.
 */
export function GlobalQuickAdd({ walletId }: { walletId: string | null }) {
  return (
    <Link
      aria-label="เพิ่มรายการการเงิน"
      href={walletId ? `/finance/quick-add?walletId=${walletId}` : "/wallets/new"}
      className="flex size-14 items-center justify-center rounded-full border-4 border-finance-surface-strong bg-finance-primary text-white shadow-[0_8px_24px_rgb(68_80_92_/_0.32)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-finance-primary"
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
