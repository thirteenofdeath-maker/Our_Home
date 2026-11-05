import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { readPages } from "@/lib/supabase/read-pages";
import { bangkokDateKey } from "@/lib/date/bangkok";
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
  overduePage?: { offset: number; size: number },
) {
  const today = bangkokDateKey();
  const loadOpen = (from: number, to: number) => {
    let query = supabase
      .from("chore_occurrences")
      .select("*")
      .eq("household_id", householdId)
      .is("completed_at", null)
      .order("due_date")
      .order("id");
    if (overduePage) query = query.lt("due_date", today);
    return query.range(from, to);
  };
  const [templates, assignees, open, recent, current, upcoming] =
    await Promise.all([
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
      overduePage
        ? (async () => {
            const { data, error } = await loadOpen(
              overduePage.offset,
              overduePage.offset + overduePage.size - 1,
            );
            if (error) throw error;
            return data ?? [];
          })()
        : readPages(loadOpen),
      supabase
        .from("chore_occurrences")
        .select("*")
        .eq("household_id", householdId)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .order("id")
        .limit(12),
      readPages((from, to) =>
        supabase
          .from("chore_occurrences")
          .select("*")
          .eq("household_id", householdId)
          .not("completed_at", "is", null)
          .gte("due_date", bangkokDateKey())
          .order("due_date")
          .order("id")
          .range(from, to),
      ),
      overduePage
        ? readPages((from, to) =>
            supabase
              .from("chore_occurrences")
              .select("*")
              .eq("household_id", householdId)
              .is("completed_at", null)
              .gte("due_date", today)
              .order("due_date")
              .order("id")
              .range(from, to),
          )
        : Promise.resolve([]),
    ]);
  if (templates.error) throw templates.error;
  if (assignees.error) throw assignees.error;
  if (recent.error) throw recent.error;
  const occurrences = [
    ...new Map(
      [...open, ...(recent.data ?? []), ...current, ...upcoming].map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  ].toSorted((a, b) => b.due_date.localeCompare(a.due_date));
  return {
    templates: templates.data ?? [],
    assignees: assignees.data ?? [],
    occurrences,
  };
}

export async function createChoreTemplate(
  supabase: Client,
  input: {
    householdId: string;
    title: string;
    details: string;
    cadence: ChoreCadence;
    intervalCount: number;
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
    p_interval_count: input.intervalCount,
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
    intervalCount: number;
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
    p_interval_count: input.intervalCount,
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

export async function deleteChoreTemplate(
  supabase: Client,
  templateId: string,
) {
  const { error } = await supabase.rpc("delete_chore_template", {
    p_template_id: templateId,
  });
  if (error) throw error;
}

export async function countOverdueChores(
  supabase: Client,
  householdId: string,
  beforeDate: string,
) {
  const { count, error } = await supabase
    .from("chore_occurrences")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .is("completed_at", null)
    .lt("due_date", beforeDate);
  if (error) throw error;
  return count ?? 0;
}

export async function clearOverdueChores(
  supabase: Client,
  householdId: string,
  beforeDate: string,
) {
  const { data, error } = await supabase.rpc("clear_overdue_chores", {
    p_household_id: householdId,
    p_before_date: beforeDate,
  });
  if (error) throw error;
  return data;
}
