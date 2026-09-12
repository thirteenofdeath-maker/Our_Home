"use client";

import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { CreateHouseholdForm } from "./CreateHouseholdForm";

/**
 * Exactly one creation type (a Household) — CreateHouseholdForm slides up
 * directly, no JIT fetch needed (the form takes no props). Reused by
 * both the no-household /household EmptyState and the onboarding screen.
 */
export function AddHouseholdTrigger({ triggerClassName, children }: { triggerClassName: string; children: React.ReactNode }) {
  return (
    <FormSheetButton triggerClassName={triggerClassName} sheetTitle="สร้างครอบครัว" form={<CreateHouseholdForm variant="sheet" />}>
      {children}
    </FormSheetButton>
  );
}
