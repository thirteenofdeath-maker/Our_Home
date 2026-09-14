"use server";

import { getMyPrimaryHousehold, listHouseholdMembers } from "@/features/household/api";
import { canInviteRole } from "@/features/household/domain/member";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Mirrors `src/app/(app)/pets/new/page.tsx`'s exact fetch/permission
 * check — the sheet must never bypass the same `canInviteRole` gate the
 * full-page route enforces.
 */
export async function getPetSheetData() {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  if (!household || !canInviteRole(household.myRole, "member")) {
    throw new Error("ไม่มีสิทธิ์เพิ่มสัตว์เลี้ยง");
  }
  const members = await listHouseholdMembers(supabase, household.id);
  return { members };
}
