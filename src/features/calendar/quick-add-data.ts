"use server";

import { getMyPrimaryHousehold, listHouseholdMembers } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";

/** Mirrors `src/app/(app)/calendar/new/page.tsx`'s exact fetch. */
export async function getCalendarEventSheetData() {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const members = household ? await listHouseholdMembers(supabase, household.id) : [];
  return { members };
}
