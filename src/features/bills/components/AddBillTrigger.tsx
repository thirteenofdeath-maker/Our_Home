"use client";

import { buttonClassName } from "@/components/ui/Button";
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
      triggerClassName={buttonClassName("primary", "lg")}
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
      + เพิ่มบิล
    </AsyncFormSheetButton>
  );
}
