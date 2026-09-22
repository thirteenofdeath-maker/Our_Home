"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";
import {
  claimChore,
  completeChore,
  createChoreTemplate,
  setChoreTemplateActive,
} from "./api";

const choreSchema = z.object({
  householdId: z.string().uuid(),
  title: z.string().trim().min(1, "กรุณาระบุชื่องานบ้าน").max(120),
  details: z.string().trim().max(1000),
  cadence: z.enum(["DAILY", "WEEKLY"]),
  startsOn: z.iso.date(),
  dueTime: z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)]),
  memberIds: z.array(z.string().uuid()).min(1, "เลือกผู้รับผิดชอบอย่างน้อย 1 คน"),
});

function stringValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function refresh() {
  revalidatePath("/chores");
  revalidatePath("/");
}

export async function createChoreAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = choreSchema.safeParse({
    householdId: stringValue(form, "householdId"),
    title: stringValue(form, "title"),
    details: stringValue(form, "details"),
    cadence: stringValue(form, "cadence"),
    startsOn: stringValue(form, "startsOn"),
    dueTime: stringValue(form, "dueTime"),
    memberIds: form
      .getAll("memberIds")
      .filter((value): value is string => typeof value === "string"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  try {
    const { supabase } = await requireUser();
    await createChoreTemplate(supabase, {
      ...parsed.data,
      dueTime: parsed.data.dueTime || null,
    });
    refresh();
    return { success: true };
  } catch (error) {
    logDatabaseErrorInDev("createChoreAction failed", error);
    return { error: "สร้างตารางงานบ้านไม่สำเร็จ" };
  }
}

export async function claimChoreAction(form: FormData) {
  const occurrenceId = stringValue(form, "occurrenceId");
  if (!z.string().uuid().safeParse(occurrenceId).success) return;
  try {
    const { supabase } = await requireUser();
    await claimChore(supabase, occurrenceId);
    refresh();
  } catch (error) {
    logDatabaseErrorInDev("claimChoreAction failed", error);
  }
}

export async function completeChoreAction(form: FormData) {
  const occurrenceId = stringValue(form, "occurrenceId");
  if (!z.string().uuid().safeParse(occurrenceId).success) return;
  try {
    const { supabase } = await requireUser();
    await completeChore(supabase, occurrenceId);
    refresh();
  } catch (error) {
    logDatabaseErrorInDev("completeChoreAction failed", error);
  }
}

export async function toggleChoreTemplateAction(form: FormData) {
  const templateId = stringValue(form, "templateId");
  const active = stringValue(form, "active") === "true";
  if (!z.string().uuid().safeParse(templateId).success) return;
  try {
    const { supabase } = await requireUser();
    await setChoreTemplateActive(supabase, templateId, active);
    refresh();
  } catch (error) {
    logDatabaseErrorInDev("toggleChoreTemplateAction failed", error);
  }
}

