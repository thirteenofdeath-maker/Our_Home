"use client";

import { AsyncFormSheetButton } from "@/components/ui/AsyncFormSheetButton";
import { AppIcon } from "@/components/ui/AppIcon";
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
      triggerClassName="app-fab fixed z-20 flex size-14 items-center justify-center rounded-full bg-finance-primary text-finance-primary-foreground shadow-[0_8px_24px_rgb(79_112_88_/_0.3)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-finance-primary bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]"
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
