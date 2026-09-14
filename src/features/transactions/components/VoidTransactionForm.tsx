import { buttonClassName } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Field";

import { voidTransactionAction } from "../actions";

export function VoidTransactionForm({ transactionId, walletId }: { transactionId: string; walletId: string }) {
  return (
    <ConfirmDialog
      action={voidTransactionAction}
      hiddenFields={{ transactionId, walletId }}
      triggerLabel="ยกเลิกรายการ"
      triggerClassName={buttonClassName("danger", "lg")}
      sheetTitle="ยกเลิกรายการ"
      description="รายการนี้จะถูกยกเลิกและไม่นับในยอดคงเหลืออีกต่อไป การดำเนินการนี้ย้อนกลับไม่ได้"
      confirmLabel="ยกเลิกรายการ"
    >
      <Input name="voidReason" type="text" placeholder="เหตุผล (ถ้ามี)" />
    </ConfirmDialog>
  );
}
