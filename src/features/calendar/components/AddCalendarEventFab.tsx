"use client";

import { AsyncFormSheetButton } from "@/components/ui/AsyncFormSheetButton";
import { AppIcon } from "@/components/ui/AppIcon";
import { APP_FAB_CLASSNAME } from "@/components/ui/fab";
import { getCalendarEventSheetData } from "../quick-add-data";
import { CalendarEventForm } from "./CalendarEventForm";

/**
 * Exactly one creation type (a Calendar event) — CalendarEventForm slides
 * up directly. Plan intentionally shares Finance V2's warm visual tone.
 * Data (household members) fetched JIT, mirroring `/calendar/new`'s
 * exact selectors.
 */
export function AddCalendarEventFab() {
  return (
    <AsyncFormSheetButton
      ariaLabel="เพิ่มกิจกรรม"
      triggerClassName={APP_FAB_CLASSNAME}
      sheetTitle="เพิ่มกิจกรรม"
      tone="finance"
      loadData={getCalendarEventSheetData}
      renderForm={(data) => (
        <CalendarEventForm members={data.members} variant="sheet" />
      )}
    >
      <AppIcon name="plus" />
    </AsyncFormSheetButton>
  );
}
