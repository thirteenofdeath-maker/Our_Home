import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { skipBillAction } from "../actions";
export function SkipBillForm({occurrenceId}:{occurrenceId:string}){
  return <ConfirmDialog
    action={skipBillAction}
    hiddenFields={{occurrenceId}}
    triggerLabel="ข้ามงวดนี้"
    triggerVariant="secondary"
    sheetTitle="ข้ามงวดนี้"
    description="งวดนี้จะถูกข้าม ไม่มีการบันทึกการชำระเงิน"
    confirmLabel="ข้ามงวดนี้"
  />;
}
