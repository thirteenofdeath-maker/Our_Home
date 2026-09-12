"use client";

import { AsyncFormSheetButton } from "@/components/ui/AsyncFormSheetButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { getCalendarEventSheetData } from "../quick-add-data";
import { CalendarEventForm } from "./CalendarEventForm";

/**
 * Exactly one creation type (a Calendar event) — CalendarEventForm slides
 * up directly. Non-Finance module: default tokens, no `tone="finance"`.
 * Data (household members) fetched JIT, mirroring `/calendar/new`'s
 * exact selectors.
 */
export function AddCalendarEventFab() {
  return (
    <AsyncFormSheetButton
      ariaLabel="เพิ่มกิจกรรม"
      triggerClassName="fixed z-20 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_8px_24px_rgb(0_0_0_/_0.24)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary right-[max(1.25rem,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]"
      sheetTitle="เพิ่มกิจกรรม"
      loadData={getCalendarEventSheetData}
      renderForm={(data) => <CalendarEventForm members={data.members} variant="sheet" />}
    >
      <AppIcon name="plus" />
    </AsyncFormSheetButton>
  );
}
