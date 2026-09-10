import { ActionButton } from "@/components/ui/ActionButton";

import { archiveWalletAction, deleteWalletAction, restoreWalletAction } from "../actions";
import type { Wallet } from "../types";

/**
 * Archive is rejected by the database unless the wallet's derived balance
 * is exactly zero; delete is rejected unless it has zero ledger history —
 * both surface their rejection through `ActionButton`'s error display
 * rather than being pre-checked here.
 */
export function WalletLifecycleControls({ wallet }: { wallet: Wallet }) {
  if (wallet.is_archived) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-card border border-border bg-surface-muted p-4">
        <p className="text-sm text-foreground-muted">กระเป๋าเงินนี้ถูกเก็บถาวรแล้ว</p>
        <div className="flex items-center gap-2">
          <form action={restoreWalletAction}>
            <input type="hidden" name="walletId" value={wallet.id} />
            <button type="submit" className="text-sm font-medium text-primary">
              กู้คืน
            </button>
          </form>
          <ActionButton action={deleteWalletAction} hiddenFields={{ walletId: wallet.id }} label="ลบถาวร" variant="danger" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <ActionButton action={archiveWalletAction} hiddenFields={{ walletId: wallet.id }} label="เก็บถาวรกระเป๋าเงิน" variant="danger" />
    </div>
  );
}
