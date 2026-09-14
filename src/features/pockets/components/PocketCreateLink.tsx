import { FormSheetButton } from "@/components/ui/FormSheetButton";

import { AddPocketForm } from "./AddPocketForm";

export function PocketCreateLink({ walletId }: { walletId: string }) {
  return (
    <FormSheetButton
      triggerClassName="flex min-h-11 items-center px-2 text-sm font-medium text-primary"
      sheetTitle="เพิ่ม Pocket"
      form={<AddPocketForm walletId={walletId} variant="sheet" />}
      tone="finance"
    >
      + เพิ่ม
    </FormSheetButton>
  );
}
