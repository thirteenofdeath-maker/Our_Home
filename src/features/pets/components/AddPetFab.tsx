"use client";

import { AsyncFormSheetButton } from "@/components/ui/AsyncFormSheetButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { APP_FAB_CLASSNAME } from "@/components/ui/fab";
import { getPetSheetData } from "../quick-add-data";
import { PetForm } from "./PetForm";

/**
 * Exactly one creation type (a Pet) — PetForm slides up directly.
 * Data (household members) is fetched JIT,
 * mirroring `/pets/new`'s exact selectors and permission gate.
 */
export function AddPetFab() {
  return (
    <AsyncFormSheetButton
      ariaLabel="เพิ่มสัตว์เลี้ยง"
      triggerClassName={APP_FAB_CLASSNAME}
      sheetTitle="เพิ่มสัตว์เลี้ยง"
      tone="finance"
      loadData={getPetSheetData}
      renderForm={(data) => <PetForm members={data.members} variant="sheet" />}
    >
      <AppIcon name="plus" />
    </AsyncFormSheetButton>
  );
}
