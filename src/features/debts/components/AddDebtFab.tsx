"use client";

import { AsyncFormSheetButton } from "@/components/ui/AsyncFormSheetButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { getDebtSheetData } from "../quick-add-data";
import { DebtCreateForm } from "./DebtForms";

const FAB_CLASSNAME =
  "fixed z-20 flex size-14 items-center justify-center rounded-full bg-finance-primary text-white shadow-[0_8px_24px_rgb(0_0_0_/_0.24)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-finance-primary right-[max(1.25rem,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]";

/**
 * Exactly one creation type (a Debt record) — DebtCreateForm slides up
 * directly. Data fetched JIT, mirroring `/finance/debts/new`'s own
 * selectors (see quick-add-data.ts). Not to be confused with "record a
 * payment"/"add principal" on an EXISTING debt — those stay their own
 * separate, non-create action-menu triggers.
 */
export function AddDebtFab({ asEmptyStateCta = false }: { asEmptyStateCta?: boolean }) {
  return (
    <div className="finance-scope contents">
      <AsyncFormSheetButton
        ariaLabel={asEmptyStateCta ? undefined : "เพิ่มรายการยืม/ให้ยืม"}
        triggerClassName={
          asEmptyStateCta
            ? "flex h-11 items-center justify-center rounded-full bg-finance-primary px-4 text-sm font-medium text-white"
            : FAB_CLASSNAME
        }
        sheetTitle="เพิ่มรายการยืม/ให้ยืม"
        tone="finance"
        loadData={getDebtSheetData}
        renderForm={(data) => <DebtCreateForm wallets={data.wallets} pockets={data.pockets} hasHousehold={data.hasHousehold} variant="sheet" />}
      >
        {asEmptyStateCta ? "+ เพิ่มรายการ" : <AppIcon name="plus" />}
      </AsyncFormSheetButton>
    </div>
  );
}
