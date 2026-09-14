"use client";

import { AsyncFormSheetButton } from "@/components/ui/AsyncFormSheetButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { getBudgetSheetData } from "../quick-add-data";
import { CreateBudgetForm } from "./CreateBudgetForm";

const FAB_CLASSNAME =
  "fixed z-20 flex size-14 items-center justify-center rounded-full bg-finance-primary text-white shadow-[0_8px_24px_rgb(0_0_0_/_0.24)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-finance-primary right-[max(1.25rem,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]";

/**
 * Exactly one creation type (a Budget) — the real CreateBudgetForm slides
 * up directly, no redundant one-item choice sheet. Data (categories/
 * household) is fetched JIT via AsyncFormSheetButton, mirroring
 * `/finance/budgets/new`'s own selectors (see quick-add-data.ts) — never
 * fetched on every /finance/budgets page load.
 */
export function AddBudgetFab({
  periodMonth,
  asEmptyStateCta = false,
  asHubCard = false,
}: {
  periodMonth: string;
  asEmptyStateCta?: boolean;
  /** The Finance Hub's own "ยังไม่มีงบประมาณเดือนนี้" dashboard row —
   * same trigger/sheet, just matching that row's existing visual instead
   * of the Budgets list page's pill-shaped empty-state CTA. */
  asHubCard?: boolean;
}) {
  const triggerClassName = asHubCard
    ? "flex items-center justify-between rounded-[1.25rem] bg-finance-surface-strong p-4 shadow-sm"
    : asEmptyStateCta
      ? "flex h-11 items-center justify-center rounded-full bg-finance-primary px-4 text-sm font-medium text-white"
      : FAB_CLASSNAME;

  return (
    <div className="finance-scope contents">
      <AsyncFormSheetButton
        ariaLabel={asEmptyStateCta || asHubCard ? undefined : "สร้างงบประมาณ"}
        triggerClassName={triggerClassName}
        sheetTitle="สร้างงบประมาณ"
        tone="finance"
        loadData={getBudgetSheetData}
        renderForm={(data) => (
          <CreateBudgetForm
            periodMonth={periodMonth}
            hasHousehold={data.hasHousehold}
            personalCategories={data.personalCategories}
            householdCategories={data.householdCategories}
            variant="sheet"
          />
        )}
      >
        {asHubCard ? (
          <>
            <span className="text-sm font-medium text-finance-text">ยังไม่มีงบประมาณเดือนนี้ · เริ่มตั้งงบ</span>
            <AppIcon name="chevron" className="size-4 text-finance-muted" />
          </>
        ) : asEmptyStateCta ? (
          "+ สร้างงบประมาณ"
        ) : (
          <AppIcon name="plus" />
        )}
      </AsyncFormSheetButton>
    </div>
  );
}
