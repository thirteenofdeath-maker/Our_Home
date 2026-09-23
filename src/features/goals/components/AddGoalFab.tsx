"use client";

import { AsyncFormSheetButton } from "@/components/ui/AsyncFormSheetButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { getGoalSheetData } from "../quick-add-data";
import { GoalForm } from "./GoalForm";

const FAB_CLASSNAME =
  "app-fab fixed z-20 flex size-14 items-center justify-center rounded-full bg-finance-primary text-finance-primary-foreground shadow-[0_8px_24px_rgb(0_0_0_/_0.24)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-finance-primary bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]";

/**
 * Exactly one creation type (a Goal) — the real GoalForm slides up
 * directly, no redundant one-item choice sheet. Data fetched JIT via
 * AsyncFormSheetButton, mirroring `/finance/goals/new`'s own selectors
 * (see quick-add-data.ts).
 */
export function AddGoalFab({
  asEmptyStateCta = false,
}: {
  asEmptyStateCta?: boolean;
}) {
  return (
    <div className="finance-scope contents">
      <AsyncFormSheetButton
        ariaLabel={asEmptyStateCta ? undefined : "เพิ่มเป้าหมายการออม"}
        triggerClassName={
          asEmptyStateCta
            ? "flex h-11 items-center justify-center rounded-full bg-finance-primary px-4 text-sm font-medium text-finance-primary-foreground"
            : FAB_CLASSNAME
        }
        sheetTitle="เพิ่มเป้าหมายการออม"
        tone="finance"
        loadData={getGoalSheetData}
        renderForm={(data) => (
          <GoalForm
            wallets={data.wallets}
            pockets={data.pockets}
            hasHousehold={data.hasHousehold}
            variant="sheet"
          />
        )}
      >
        {asEmptyStateCta ? "+ เพิ่มเป้าหมาย" : <AppIcon name="plus" />}
      </AsyncFormSheetButton>
    </div>
  );
}
