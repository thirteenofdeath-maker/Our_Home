"use client";

import { AppIcon } from "@/components/ui/AppIcon";
import { FormSheetButton } from "@/components/ui/FormSheetButton";
import type { HouseholdMemberWithProfile } from "@/features/household/types";

import { PetForm } from "./PetForm";

/**
 * Exactly one creation type (a Pet) — PetForm slides up directly. Household
 * members are loaded by the authenticated Server Component that also applies
 * the permission gate, so opening the sheet never depends on a second network
 * request or a deployment-sensitive Server Action reference.
 */
export function AddPetFab({
  members,
}: {
  members: HouseholdMemberWithProfile[];
}) {
  return (
    <FormSheetButton
      ariaLabel="เพิ่มสัตว์เลี้ยง"
      triggerClassName="app-fab desktop-dashboard-fab fixed z-20 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_rgb(0_0_0_/_0.24)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:landscape:w-auto lg:landscape:gap-2 lg:landscape:px-5"
      sheetTitle="เพิ่มสัตว์เลี้ยง"
      tone="finance"
      form={<PetForm members={members} variant="sheet" />}
    >
      <AppIcon name="plus" />
      <span className="hidden lg:landscape:inline">เพิ่มสัตว์เลี้ยง</span>
    </FormSheetButton>
  );
}
