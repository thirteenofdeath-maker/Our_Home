import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import { getAvatarDisplayUrl } from "@/features/profile/api";

import type { HouseholdMemberWithProfile, HouseholdWithRole } from "./types";

/**
 * Repository layer for households. This is the only place in the codebase
 * that issues Supabase queries for this feature — pages and Server Actions
 * call these functions, never the Supabase client directly.
 *
 * Milestone 1 only ever surfaces one household per user in the UI (the
 * "first" one found), even though the data model and RLS already support a
 * user belonging to several — see docs/ARCHITECTURE.md.
 */

export async function getMyPrimaryHousehold(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<HouseholdWithRole | null> {
  const { data, error } = await supabase
    .from("household_members")
    .select("role, household:households(*)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) logDatabaseErrorInDev("getMyPrimaryHousehold failed", error);
  if (error || !data || !data.household) return null;

  return { ...data.household, myRole: data.role };
}

export async function listHouseholdMembers(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<HouseholdMemberWithProfile[]> {
  const { data, error } = await supabase
    .from("household_members")
    .select("*, profile:profiles(display_name, email, avatar_url)")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  if (error) logDatabaseErrorInDev("listHouseholdMembers failed", error);
  const members = (data ?? []) as unknown as HouseholdMemberWithProfile[];
  return Promise.all(members.map(async (member) => ({
    ...member,
    profile: member.profile ? {
      ...member.profile,
      avatar_url: await getAvatarDisplayUrl(supabase, member.profile.avatar_url),
    } : null,
  })));
}

export async function updateOwnMemberPresentation(
  supabase: SupabaseClient<Database>,
  params: { householdId: string; displayName: string; memberColor: string },
) {
  const { data, error } = await supabase.rpc("update_member_presentation", {
    p_household_id: params.householdId,
    p_display_name: params.displayName,
    p_member_color: params.memberColor,
  });
  if (error) throw error;
  return data;
}

export async function changeMemberRole(
  supabase: SupabaseClient<Database>,
  params: { householdId: string; memberId: string; role: "admin" | "member" },
) {
  const { data, error } = await supabase.rpc("change_household_member_role", {
    p_household_id: params.householdId,
    p_member_id: params.memberId,
    p_role: params.role,
  });
  if (error) throw error;
  return data;
}

export async function createHousehold(
  supabase: SupabaseClient<Database>,
  params: { name: string; createdBy: string },
) {
  // Do not chain `.select()` here. The INSERT policy validates created_by,
  // while the SELECT policy requires owner membership. That membership is
  // created by an AFTER INSERT trigger, so requesting INSERT ... RETURNING
  // creates a cyclic visibility check before the trigger-created membership
  // can satisfy the SELECT policy. The action does not need the new row.
  const { error } = await supabase.from("households").insert({
    name: params.name,
    created_by: params.createdBy,
  });

  if (error) {
    // The owner membership is created by an AFTER INSERT trigger in the
    // same transaction. A trigger failure is therefore reported here as
    // the household insert error; there is no second application query.
    logDatabaseErrorInDev("createHousehold household insert failed", error);
    throw error;
  }
}

export async function addHouseholdMemberByEmail(
  supabase: SupabaseClient<Database>,
  params: { householdId: string; email: string; role?: "admin" | "member" },
) {
  const { data, error } = await supabase.rpc("add_household_member", {
    p_household_id: params.householdId,
    p_email: params.email,
    p_role: params.role ?? "member",
  });

  if (error) throw error;
  return data;
}
