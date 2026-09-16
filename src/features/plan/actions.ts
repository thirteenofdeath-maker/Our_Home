"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";
import {
  addPlanTaskStep,
  createPlanNote,
  createPlanReminder,
  createPlanTask,
  deletePlanTaskStep,
  getPlanNote,
  getPlanReminder,
  getPlanTask,
  listPlanTaskSteps,
  setPlanNoteArchived,
  setPlanNotePinned,
  setPlanReminderArchived,
  setPlanReminderCompleted,
  setPlanTaskArchived,
  setPlanTaskCompleted,
  setPlanTaskStepCompleted,
  updatePlanNote,
  updatePlanReminder,
  updatePlanTask,
} from "./api";
import {
  planNoteFormSchema,
  planReminderFormSchema,
  planTaskFormSchema,
  planTaskStepSchema,
  reminderIso,
} from "./domain";

function value(form: FormData, key: string) {
  const entry = form.get(key);
  return typeof entry === "string" ? entry : "";
}

function parseTask(form: FormData) {
  return planTaskFormSchema.safeParse({
    title: value(form, "title"),
    details: value(form, "details"),
    listName: value(form, "listName") || "งานของฉัน",
    scope: value(form, "scope"),
    dueDate: value(form, "dueDate"),
    dueTime: value(form, "dueTime"),
    priority: value(form, "priority") || "NORMAL",
  });
}

function parseNote(form: FormData) {
  return planNoteFormSchema.safeParse({
    title: value(form, "title"),
    content: value(form, "content"),
    scope: value(form, "scope"),
    color: value(form, "color") || "SAGE",
  });
}

function parseReminder(form: FormData) {
  return planReminderFormSchema.safeParse({
    title: value(form, "title"),
    note: value(form, "note"),
    scope: value(form, "scope"),
    remindDate: value(form, "remindDate"),
    remindTime: value(form, "remindTime"),
    recurrence: value(form, "recurrence") || "NONE",
  });
}

async function householdForScope(scope: "PERSONAL" | "HOUSEHOLD") {
  const auth = await requireUser();
  if (scope === "PERSONAL") return { ...auth, householdId: null };
  const household = await getMyPrimaryHousehold(auth.supabase, auth.user.id);
  if (!household) throw new Error("Household not found");
  return { ...auth, householdId: household.id };
}

export async function createPlanTaskAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = parseTask(form);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  try {
    const { supabase, user, householdId } = await householdForScope(
      parsed.data.scope,
    );
    const id = randomUUID();
    await createPlanTask(supabase, {
      id,
      createdBy: user.id,
      householdId,
      ...parsed.data,
    });
    revalidatePath("/calendar");
    redirect(`/calendar/tasks/${id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    logDatabaseErrorInDev("createPlanTaskAction failed", error);
    return { error: "บันทึกงานไม่สำเร็จ" };
  }
}

export async function updatePlanTaskAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = value(form, "taskId");
  const parsed = parseTask(form);
  if (!id || !parsed.success) {
    return {
      error: parsed.success
        ? "ไม่พบงาน"
        : (parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"),
    };
  }
  try {
    const { supabase } = await requireUser();
    const current = await getPlanTask(supabase, id);
    if (!current) return { error: "ไม่พบงาน" };
    await updatePlanTask(supabase, id, parsed.data);
    revalidatePath("/calendar");
    revalidatePath(`/calendar/tasks/${id}`);
    return {};
  } catch (error) {
    logDatabaseErrorInDev("updatePlanTaskAction failed", error);
    return { error: "แก้ไขงานไม่สำเร็จ" };
  }
}

export async function togglePlanTaskAction(form: FormData) {
  const id = value(form, "taskId");
  const completed = value(form, "completed") === "true";
  if (!id) return;
  const { supabase } = await requireUser();
  const task = await getPlanTask(supabase, id);
  if (!task) return;
  await setPlanTaskCompleted(supabase, task, completed);
  revalidatePath("/calendar");
  revalidatePath(`/calendar/tasks/${id}`);
}

export async function archivePlanTaskAction(form: FormData) {
  const id = value(form, "taskId");
  if (!id) return;
  const { supabase } = await requireUser();
  if (!(await getPlanTask(supabase, id))) return;
  await setPlanTaskArchived(supabase, id, value(form, "archived") === "true");
  revalidatePath("/calendar");
  redirect("/calendar?view=tasks");
}

export async function addPlanTaskStepAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const taskId = value(form, "taskId");
  const parsed = planTaskStepSchema.safeParse({ title: value(form, "title") });
  if (!taskId || !parsed.success) {
    return {
      error: parsed.success
        ? "ไม่พบงาน"
        : (parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"),
    };
  }
  try {
    const { supabase, user } = await requireUser();
    if (!(await getPlanTask(supabase, taskId))) return { error: "ไม่พบงาน" };
    const steps = await listPlanTaskSteps(supabase, taskId);
    await addPlanTaskStep(supabase, {
      id: randomUUID(),
      taskId,
      createdBy: user.id,
      title: parsed.data.title,
      position: steps.length,
    });
    revalidatePath(`/calendar/tasks/${taskId}`);
    return {};
  } catch (error) {
    logDatabaseErrorInDev("addPlanTaskStepAction failed", error);
    return { error: "เพิ่มรายการย่อยไม่สำเร็จ" };
  }
}

export async function togglePlanTaskStepAction(form: FormData) {
  const taskId = value(form, "taskId");
  const stepId = value(form, "stepId");
  if (!taskId || !stepId) return;
  const { supabase } = await requireUser();
  if (!(await getPlanTask(supabase, taskId))) return;
  const step = (await listPlanTaskSteps(supabase, taskId)).find(
    (item) => item.id === stepId,
  );
  if (!step) return;
  await setPlanTaskStepCompleted(
    supabase,
    step,
    value(form, "completed") === "true",
  );
  revalidatePath(`/calendar/tasks/${taskId}`);
}

export async function deletePlanTaskStepAction(form: FormData) {
  const taskId = value(form, "taskId");
  const stepId = value(form, "stepId");
  if (!taskId || !stepId) return;
  const { supabase } = await requireUser();
  if (!(await getPlanTask(supabase, taskId))) return;
  await deletePlanTaskStep(supabase, stepId);
  revalidatePath(`/calendar/tasks/${taskId}`);
}

export async function createPlanNoteAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = parseNote(form);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  try {
    const { supabase, user, householdId } = await householdForScope(
      parsed.data.scope,
    );
    const id = randomUUID();
    await createPlanNote(supabase, {
      id,
      createdBy: user.id,
      householdId,
      ...parsed.data,
    });
    revalidatePath("/calendar");
    redirect(`/calendar/notes/${id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    logDatabaseErrorInDev("createPlanNoteAction failed", error);
    return { error: "บันทึกโน้ตไม่สำเร็จ" };
  }
}

export async function updatePlanNoteAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = value(form, "noteId");
  const parsed = parseNote(form);
  if (!id || !parsed.success) {
    return {
      error: parsed.success
        ? "ไม่พบโน้ต"
        : (parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"),
    };
  }
  try {
    const { supabase } = await requireUser();
    const current = await getPlanNote(supabase, id);
    if (!current) return { error: "ไม่พบโน้ต" };
    await updatePlanNote(supabase, id, parsed.data);
    revalidatePath("/calendar");
    revalidatePath(`/calendar/notes/${id}`);
    return {};
  } catch (error) {
    logDatabaseErrorInDev("updatePlanNoteAction failed", error);
    return { error: "แก้ไขโน้ตไม่สำเร็จ" };
  }
}

export async function pinPlanNoteAction(form: FormData) {
  const id = value(form, "noteId");
  if (!id) return;
  const { supabase } = await requireUser();
  const note = await getPlanNote(supabase, id);
  if (!note) return;
  await setPlanNotePinned(supabase, note, value(form, "pinned") === "true");
  revalidatePath("/calendar");
  revalidatePath(`/calendar/notes/${id}`);
}

export async function archivePlanNoteAction(form: FormData) {
  const id = value(form, "noteId");
  if (!id) return;
  const { supabase } = await requireUser();
  if (!(await getPlanNote(supabase, id))) return;
  await setPlanNoteArchived(supabase, id, value(form, "archived") === "true");
  revalidatePath("/calendar");
  redirect("/calendar?view=notes");
}

export async function createPlanReminderAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = parseReminder(form);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  try {
    const { supabase, user, householdId } = await householdForScope(
      parsed.data.scope,
    );
    const id = randomUUID();
    await createPlanReminder(supabase, {
      id,
      createdBy: user.id,
      householdId,
      scope: parsed.data.scope,
      title: parsed.data.title,
      note: parsed.data.note,
      remindsAt: reminderIso(parsed.data.remindDate, parsed.data.remindTime),
      recurrence: parsed.data.recurrence,
    });
    revalidatePath("/");
    revalidatePath("/calendar");
    redirect(`/calendar/reminders/${id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    logDatabaseErrorInDev("createPlanReminderAction failed", error);
    return { error: "บันทึกรายการเตือนไม่สำเร็จ" };
  }
}

export async function updatePlanReminderAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = value(form, "reminderId");
  const parsed = parseReminder(form);
  if (!id || !parsed.success) {
    return {
      error: parsed.success
        ? "ไม่พบรายการเตือน"
        : (parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"),
    };
  }
  try {
    const { supabase } = await requireUser();
    if (!(await getPlanReminder(supabase, id)))
      return { error: "ไม่พบรายการเตือน" };
    await updatePlanReminder(supabase, id, {
      title: parsed.data.title,
      note: parsed.data.note,
      remindsAt: reminderIso(parsed.data.remindDate, parsed.data.remindTime),
      recurrence: parsed.data.recurrence,
    });
    revalidatePath("/");
    revalidatePath("/calendar");
    revalidatePath(`/calendar/reminders/${id}`);
    return { success: true };
  } catch (error) {
    logDatabaseErrorInDev("updatePlanReminderAction failed", error);
    return { error: "แก้ไขรายการเตือนไม่สำเร็จ" };
  }
}

export async function togglePlanReminderAction(form: FormData) {
  const id = value(form, "reminderId");
  if (!id) return;
  const { supabase } = await requireUser();
  const reminder = await getPlanReminder(supabase, id);
  if (!reminder) return;
  await setPlanReminderCompleted(
    supabase,
    reminder,
    value(form, "completed") === "true",
  );
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath(`/calendar/reminders/${id}`);
}

export async function archivePlanReminderAction(form: FormData) {
  const id = value(form, "reminderId");
  if (!id) return;
  const { supabase } = await requireUser();
  if (!(await getPlanReminder(supabase, id))) return;
  await setPlanReminderArchived(
    supabase,
    id,
    value(form, "archived") === "true",
  );
  revalidatePath("/");
  revalidatePath("/calendar");
  redirect("/calendar?view=reminders");
}
