import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

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

  if (error || !data || !data.household) return null;

  return { ...data.household, myRole: data.role };
}

export async function listHouseholdMembers(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<HouseholdMemberWithProfile[]> {
  const { data, error } = await supabase
    .from("household_members")
    .select("*, profile:profiles(display_name, email)")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as unknown as HouseholdMemberWithProfile[];
}

export async function createHousehold(
  supabase: SupabaseClient<Database>,
  params: { name: string; createdBy: string },
) {
  const { data, error } = await supabase
    .from("households")
    .insert({ name: params.name, created_by: params.createdBy })
    .select()
    .single();

  if (error) throw error;
  return data;
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
