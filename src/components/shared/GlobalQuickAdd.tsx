"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { financeExpenseHref, financeIncomeHref, financeTransferHref } from "@/features/finance/domain/finance";
import { FinanceCreateFlow } from "@/features/finance/components/FinanceCreateFlow";
import { getCreateWalletSheetData } from "@/features/finance/quick-add-data";
import { WalletForm } from "@/features/wallets/components/WalletForm";

/**
 * The Finance quick-add FAB. With a wallet already available, the
 * authoritative two-stage sheet flow (choose รายรับ/รายจ่าย/โอนเงิน, then
 * that FORM slides up in the same sheet) lives entirely in
 * FinanceCreateFlow — see that file for the state machine and why Save
 * needs no special handling (the existing Server Actions already
 * redirect on success / return {error} otherwise). With zero wallets,
 * there is exactly ONE possible creation type (a wallet), so the real
 * WalletForm slides up directly — no redundant one-item choice sheet.
 */
export function GlobalQuickAdd({ walletId }: { walletId: string | null }) {
  if (walletId) return <FinanceCreateFlow walletId={walletId} />;
  return <CreateFirstWalletFab />;
}

function CreateFirstWalletFab() {
  // Only fetched for users with zero wallets (a rare, new-user-only
  // path) — never on every Finance page load; see quick-add-data.ts.
  const [hasHousehold, setHasHousehold] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    getCreateWalletSheetData().then((data) => {
      if (!cancelled) setHasHousehold(data.hasHousehold);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="finance-scope contents">
      <FormSheetButton
        ariaLabel="เพิ่มรายการการเงิน"
        triggerClassName="fixed z-20 flex size-14 items-center justify-center rounded-full bg-finance-primary text-white shadow-[0_8px_24px_rgb(0_0_0_/_0.24)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-finance-primary right-[max(1.25rem,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]"
        sheetTitle="สร้างกระเป๋าเงิน"
        form={
          hasHousehold === null ? (
            <p className="text-sm text-finance-muted">กำลังโหลด...</p>
          ) : (
            <WalletForm defaultScope="PERSONAL" hasHousehold={hasHousehold} variant="sheet" />
          )
        }
        tone="finance"
      >
        <AppIcon name="plus" />
      </FormSheetButton>
    </div>
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
