import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, PlanNoteColor, PlanTaskPriority } from "@/types/database";
import type { PlanNote, PlanTask, PlanTaskStep } from "./types";

type Client = SupabaseClient<Database>;

export async function listPlanTasks(
  supabase: Client,
  options: { includeArchived?: boolean; completed?: boolean; query?: string } = {},
) {
  let request = supabase
    .from("plan_tasks")
    .select("*")
    .order("is_completed")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("due_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  request = options.includeArchived
    ? request.not("archived_at", "is", null)
    : request.is("archived_at", null);
  if (typeof options.completed === "boolean") {
    request = request.eq("is_completed", options.completed);
  }
  const { data, error } = await request;
  if (error) throw error;
  const query = options.query?.trim().toLocaleLowerCase("th");
  if (!query) return data ?? [];
  return (data ?? []).filter((task) =>
    [task.title, task.details, task.list_name]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase("th").includes(query)),
  );
}

export async function getPlanTask(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("plan_tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listPlanTaskSteps(supabase: Client, taskId: string) {
  const { data, error } = await supabase
    .from("plan_task_steps")
    .select("*")
    .eq("task_id", taskId)
    .order("position")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function createPlanTask(
  supabase: Client,
  input: {
    id: string;
    createdBy: string;
    householdId: string | null;
    scope: "PERSONAL" | "HOUSEHOLD";
    title: string;
    details: string | null;
    listName: string;
    dueDate: string | null;
    dueTime: string | null;
    priority: PlanTaskPriority;
  },
) {
  const { error } = await supabase.from("plan_tasks").insert({
    id: input.id,
    created_by: input.createdBy,
    household_id: input.householdId,
    scope: input.scope,
    title: input.title,
    details: input.details,
    list_name: input.listName,
    due_date: input.dueDate,
    due_time: input.dueTime,
    priority: input.priority,
  });
  if (error) throw error;
}

export async function updatePlanTask(
  supabase: Client,
  id: string,
  input: {
    title: string;
    details: string | null;
    listName: string;
    dueDate: string | null;
    dueTime: string | null;
    priority: PlanTaskPriority;
  },
) {
  const { error } = await supabase.from("plan_tasks").update({
    title: input.title,
    details: input.details,
    list_name: input.listName,
    due_date: input.dueDate,
    due_time: input.dueTime,
    priority: input.priority,
  }).eq("id", id);
  if (error) throw error;
}

export async function setPlanTaskCompleted(supabase: Client, task: PlanTask, completed: boolean) {
  const { error } = await supabase.from("plan_tasks").update({
    is_completed: completed,
    completed_at: completed ? new Date().toISOString() : null,
  }).eq("id", task.id);
  if (error) throw error;
}

export async function setPlanTaskArchived(supabase: Client, id: string, archived: boolean) {
  const { error } = await supabase.from("plan_tasks")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

export async function addPlanTaskStep(
  supabase: Client,
  input: { id: string; taskId: string; createdBy: string; title: string; position: number },
) {
  const { error } = await supabase.from("plan_task_steps").insert({
    id: input.id,
    task_id: input.taskId,
    created_by: input.createdBy,
    title: input.title,
    position: input.position,
  });
  if (error) throw error;
}

export async function setPlanTaskStepCompleted(
  supabase: Client,
  step: PlanTaskStep,
  completed: boolean,
) {
  const { error } = await supabase.from("plan_task_steps").update({
    is_completed: completed,
    completed_at: completed ? new Date().toISOString() : null,
  }).eq("id", step.id);
  if (error) throw error;
}

export async function deletePlanTaskStep(supabase: Client, id: string) {
  const { error } = await supabase.from("plan_task_steps").delete().eq("id", id);
  if (error) throw error;
}

export async function listPlanNotes(
  supabase: Client,
  options: { archived?: boolean; query?: string } = {},
) {
  let request = supabase
    .from("plan_notes")
    .select("*");
  request = options.archived
    ? request.not("archived_at", "is", null)
    : request.is("archived_at", null);
  request = request
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });
  const { data, error } = await request;
  if (error) throw error;
  const query = options.query?.trim().toLocaleLowerCase("th");
  if (!query) return data ?? [];
  return (data ?? []).filter((note) =>
    [note.title, note.content]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase("th").includes(query)),
  );
}

export async function getPlanNote(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("plan_notes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createPlanNote(
  supabase: Client,
  input: {
    id: string;
    createdBy: string;
    householdId: string | null;
    scope: "PERSONAL" | "HOUSEHOLD";
    title: string | null;
    content: string | null;
    color: PlanNoteColor;
  },
) {
  const { error } = await supabase.from("plan_notes").insert({
    id: input.id,
    created_by: input.createdBy,
    household_id: input.householdId,
    scope: input.scope,
    title: input.title,
    content: input.content,
    color: input.color,
  });
  if (error) throw error;
}

export async function updatePlanNote(
  supabase: Client,
  id: string,
  input: { title: string | null; content: string | null; color: PlanNoteColor },
) {
  const { error } = await supabase.from("plan_notes").update(input).eq("id", id);
  if (error) throw error;
}

export async function setPlanNotePinned(supabase: Client, note: PlanNote, pinned: boolean) {
  const { error } = await supabase.from("plan_notes")
    .update({ pinned_at: pinned ? new Date().toISOString() : null })
    .eq("id", note.id);
  if (error) throw error;
}

export async function setPlanNoteArchived(supabase: Client, id: string, archived: boolean) {
  const { error } = await supabase.from("plan_notes")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}
