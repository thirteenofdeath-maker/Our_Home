import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ChoreCadence, Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export async function materializeChores(
  supabase: Client,
  householdId: string,
  throughDate: string,
) {
  const { error } = await supabase.rpc("materialize_chore_occurrences", {
    p_household_id: householdId,
    p_through_date: throughDate,
  });
  if (error) throw error;
}

export async function listChoreWorkspace(
  supabase: Client,
  householdId: string,
) {
  const [templates, assignees, occurrences] = await Promise.all([
    supabase
      .from("chore_templates")
      .select("*")
      .eq("household_id", householdId)
      .order("created_at"),
    supabase
      .from("chore_template_assignees")
      .select("*")
      .eq("household_id", householdId)
      .order("position"),
    supabase
      .from("chore_occurrences")
      .select("*")
      .eq("household_id", householdId)
      .order("due_date", { ascending: false })
      .limit(120),
  ]);
  if (templates.error) throw templates.error;
  if (assignees.error) throw assignees.error;
  if (occurrences.error) throw occurrences.error;
  return {
    templates: templates.data ?? [],
    assignees: assignees.data ?? [],
    occurrences: occurrences.data ?? [],
  };
}

export async function createChoreTemplate(
  supabase: Client,
  input: {
    householdId: string;
    title: string;
    details: string;
    cadence: ChoreCadence;
    startsOn: string;
    dueTime: string | null;
    memberIds: string[];
  },
) {
  const { error } = await supabase.rpc("create_chore_template", {
    p_household_id: input.householdId,
    p_title: input.title,
    p_details: input.details,
    p_cadence: input.cadence,
    p_starts_on: input.startsOn,
    p_due_time: input.dueTime,
    p_member_ids: input.memberIds,
  });
  if (error) throw error;
}

export async function updateChoreTemplate(
  supabase: Client,
  input: {
    templateId: string;
    title: string;
    details: string;
    cadence: ChoreCadence;
    startsOn: string;
    dueTime: string | null;
    memberIds: string[];
  },
) {
  const { error } = await supabase.rpc("update_chore_template", {
    p_template_id: input.templateId,
    p_title: input.title,
    p_details: input.details,
    p_cadence: input.cadence,
    p_starts_on: input.startsOn,
    p_due_time: input.dueTime,
    p_member_ids: input.memberIds,
  });
  if (error) throw error;
}

export async function claimChore(supabase: Client, occurrenceId: string) {
  const { error } = await supabase.rpc("claim_chore_occurrence", {
    p_occurrence_id: occurrenceId,
  });
  if (error) throw error;
}

export async function completeChore(supabase: Client, occurrenceId: string) {
  const { error } = await supabase.rpc("complete_chore_occurrence", {
    p_occurrence_id: occurrenceId,
  });
  if (error) throw error;
}

export async function setChoreTemplateActive(
  supabase: Client,
  templateId: string,
  active: boolean,
) {
  const { error } = await supabase.rpc("set_chore_template_active", {
    p_template_id: templateId,
    p_active: active,
  });
  if (error) throw error;
}
