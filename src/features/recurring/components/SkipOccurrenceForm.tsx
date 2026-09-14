import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

import { skipOccurrenceAction } from "../actions";

export function SkipOccurrenceForm({ occurrenceId, recurringId }: { occurrenceId: string; recurringId: string }) {
  return (
    <ConfirmDialog
      action={skipOccurrenceAction}
      hiddenFields={{ occurrenceId, recurringId }}
      triggerLabel="ข้ามรายการนี้"
      triggerVariant="secondary"
      sheetTitle="ข้ามรายการนี้"
      description="รายการที่กำหนดไว้นี้จะถูกข้าม ไม่มีการบันทึกรายการทางการเงิน"
      confirmLabel="ข้ามรายการนี้"
    />
  );
}
