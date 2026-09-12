import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

import { archiveWalletAction, deleteWalletAction, restoreWalletAction } from "../actions";
import type { Wallet } from "../types";

/**
 * Archive is rejected by the database unless the wallet's derived balance
 * is exactly zero; delete is rejected unless it has zero ledger history —
 * both surface their rejection through ConfirmDialog's error display
 * (the same useActionState wiring ActionButton used) rather than being
 * pre-checked here. Both are high-consequence/irreversible-ish lifecycle
 * actions, so both go through a slide-up confirmation instead of a bare
 * one-tap destructive submit — restore (fully reversible, low-stakes)
 * stays a plain inline button.
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
          <ConfirmDialog
            action={deleteWalletAction}
            hiddenFields={{ walletId: wallet.id }}
            triggerLabel="ลบถาวร"
            sheetTitle="ลบกระเป๋าเงินถาวร"
            description={`ลบ "${wallet.name}" อย่างถาวร การลบจะสำเร็จเฉพาะเมื่อไม่มีประวัติรายการในกระเป๋าเงินนี้ ไม่สามารถย้อนกลับได้`}
            confirmLabel="ลบถาวร"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <ConfirmDialog
        action={archiveWalletAction}
        hiddenFields={{ walletId: wallet.id }}
        triggerLabel="เก็บถาวรกระเป๋าเงิน"
        sheetTitle="เก็บถาวรกระเป๋าเงิน"
        description={`เก็บ "${wallet.name}" เข้าคลัง จะสำเร็จเฉพาะเมื่อยอดคงเหลือเป็นศูนย์ กู้คืนได้ภายหลัง`}
        confirmLabel="เก็บถาวร"
      />
    </div>
  );
}
