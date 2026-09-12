"use client";

import type { ReactNode } from "react";

import { buttonClassName } from "@/components/ui/Button";
import { AsyncFormSheetButton } from "@/components/ui/AsyncFormSheetButton";
import { getTemplateSheetData } from "../quick-add-data";
import { CreateTemplateForm } from "./CreateTemplateForm";

/**
 * Exactly one creation type (a Template) — CreateTemplateForm slides up
 * directly (replaces the previous plain navigation link, which just
 * navigated to /finance/templates/new). Also serves "สร้าง Template
 * จากรายการนี้" (pass `fromTransactionId`) — same form, same sheet, same
 * JIT loader (see quick-add-data.ts), just with the transaction's
 * allowed fields prefilled. The full-page /finance/templates/new route
 * (with or without `?fromTransactionId=`) stays alive as a deep-link/
 * fallback, sharing this exact loader — never a duplicated prefill rule.
 */
export function CreateTemplateTrigger({
  fromTransactionId,
  triggerClassName,
  children,
}: {
  fromTransactionId?: string;
  triggerClassName?: string;
  children?: ReactNode;
}) {
  return (
    <AsyncFormSheetButton
      triggerClassName={triggerClassName ?? buttonClassName("primary", "lg")}
      sheetTitle="สร้าง Template"
      tone="finance"
      loadData={() => getTemplateSheetData(fromTransactionId)}
      renderForm={(data) => (
        <CreateTemplateForm
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
          initialScope={data.initialScope}
          initialTransactionType={data.initialTransactionType}
          initialName={data.initialName}
          initialWalletId={data.initialWalletId}
          initialPocketId={data.initialPocketId}
          initialCategoryId={data.initialCategoryId}
          initialAmount={data.initialAmount}
          initialTitle={data.initialTitle}
          initialNote={data.initialNote}
          initialTagIds={data.initialTagIds}
          variant="sheet"
        />
      )}
    >
      {children ?? "+ สร้าง Template"}
    </AsyncFormSheetButton>
  );
}
