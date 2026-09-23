"use client";

import { AppIcon } from "@/components/ui/AppIcon";
import { AsyncFormSheetButton } from "@/components/ui/AsyncFormSheetButton";
import { getBillSheetData } from "../quick-add-data";
import { BillForm } from "./BillForm";

/**
 * Exactly one creation type (a Bill) — BillForm slides up directly, no
 * redundant one-item choice sheet in front of it (replaces the previous
 * a plain navigation link, which just navigated to /finance/bills/new).
 */
export function AddBillTrigger() {
  return (
    <AsyncFormSheetButton
      triggerClassName="fixed z-20 flex size-14 items-center justify-center rounded-full bg-finance-primary text-finance-primary-foreground shadow-[0_8px_24px_rgb(0_0_0_/_0.24)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-finance-primary right-[max(1.25rem,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]"
      ariaLabel="เพิ่มบิล"
      sheetTitle="เพิ่มบิล"
      tone="finance"
      loadData={getBillSheetData}
      renderForm={(data) => (
        <BillForm
          wallets={data.wallets}
          pocketsByWallet={data.pocketsByWallet}
          categories={data.categories}
          tags={data.tags}
          hasHousehold={data.hasHousehold}
          variant="sheet"
        />
      )}
    >
      <AppIcon name="plus" />
    </AsyncFormSheetButton>
  );
}
