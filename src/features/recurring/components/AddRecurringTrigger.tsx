"use client";

import { AppIcon } from "@/components/ui/AppIcon";
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
      triggerClassName="fixed z-20 flex size-14 items-center justify-center rounded-full bg-finance-primary text-finance-primary-foreground shadow-[0_8px_24px_rgb(0_0_0_/_0.24)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-finance-primary right-[max(1.25rem,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]"
      ariaLabel="เพิ่มรายการประจำ"
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
      <AppIcon name="plus" />
    </AsyncFormSheetButton>
  );
}
