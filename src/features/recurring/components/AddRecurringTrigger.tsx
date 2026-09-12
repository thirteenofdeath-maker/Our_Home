"use client";

import { buttonClassName } from "@/components/ui/Button";
import { AsyncFormSheetButton } from "@/components/ui/AsyncFormSheetButton";
import { getRecurringSheetData } from "../quick-add-data";
import { CreateRecurringForm } from "./CreateRecurringForm";

/**
 * Exactly one creation type (a Recurring transaction rule) —
 * CreateRecurringForm slides up directly (replaces the previous
 * a plain navigation link, which just navigated to /finance/recurring/new).
 */
export function AddRecurringTrigger() {
  return (
    <AsyncFormSheetButton
      triggerClassName={buttonClassName("primary", "lg")}
      sheetTitle="เพิ่มรายการประจำ"
      tone="finance"
      loadData={getRecurringSheetData}
      renderForm={(data) => (
        <CreateRecurringForm
          hasHousehold={data.hasHousehold}
          personalWallets={data.personalWallets}
          householdWallets={data.householdWallets}
          pocketsByWallet={data.pocketsByWallet}
          personalIncomeCategories={data.personalIncomeCategories}
          personalExpenseCategories={data.personalExpenseCategories}
          householdIncomeCategories={data.householdIncomeCategories}
          householdExpenseCategories={data.householdExpenseCategories}
          personalTags={data.personalTags}
          householdTags={data.householdTags}
          variant="sheet"
        />
      )}
    >
      + เพิ่มรายการประจำ
    </AsyncFormSheetButton>
  );
}
