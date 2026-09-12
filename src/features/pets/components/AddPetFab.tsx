"use client";

import { AsyncFormSheetButton } from "@/components/ui/AsyncFormSheetButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { getPetSheetData } from "../quick-add-data";
import { PetForm } from "./PetForm";

/**
 * Exactly one creation type (a Pet) — PetForm slides up directly.
 * Non-Finance module: uses the app's default/global tokens, never
 * Finance V2 (`tone` intentionally omitted — AsyncFormSheetButton
 * defaults to "default"). Data (household members) fetched JIT,
 * mirroring `/pets/new`'s exact selectors and permission gate.
 */
export function AddPetFab() {
  return (
    <AsyncFormSheetButton
      ariaLabel="เพิ่มสัตว์เลี้ยง"
      triggerClassName="fixed z-20 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_8px_24px_rgb(0_0_0_/_0.24)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary right-[max(1.25rem,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]"
      sheetTitle="เพิ่มสัตว์เลี้ยง"
      loadData={getPetSheetData}
      renderForm={(data) => <PetForm members={data.members} variant="sheet" />}
    >
      <AppIcon name="plus" />
    </AsyncFormSheetButton>
  );
}
