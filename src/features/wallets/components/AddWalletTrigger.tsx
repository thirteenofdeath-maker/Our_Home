"use client";

import { AsyncFormSheetButton } from "@/components/ui/AsyncFormSheetButton";
import { getCreateWalletSheetData } from "@/features/finance/quick-add-data";
import { WalletForm } from "./WalletForm";

/**
 * Exactly one creation type (a Wallet) — WalletForm slides up directly.
 * Reuses the exact same JIT loader GlobalQuickAdd's zero-wallet fallback
 * already uses (getCreateWalletSheetData), never a duplicated fetch.
 * For dashboard/empty-state shortcuts to wallet creation OTHER than the
 * canonical /wallets list page (which has its own FormSheetButton
 * trigger with data already on hand — see wallets/page.tsx).
 */
export function AddWalletTrigger({ triggerClassName, children }: { triggerClassName: string; children: React.ReactNode }) {
  return (
    <div className="finance-scope contents">
      <AsyncFormSheetButton
        triggerClassName={triggerClassName}
        sheetTitle="สร้างกระเป๋าเงิน"
        tone="finance"
        loadData={getCreateWalletSheetData}
        renderForm={(data) => <WalletForm defaultScope="PERSONAL" hasHousehold={data.hasHousehold} variant="sheet" />}
      >
        {children}
      </AsyncFormSheetButton>
    </div>
  );
}
