"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import type { ActionState } from "@/lib/types/action-state";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";

import {
  addHouseholdMemberByEmail,
  removeHouseholdMember,
  changeMemberRole,
  createHousehold,
  updateOwnMemberPresentation,
} from "./api";
import { MEMBER_COLOR_PATTERN } from "./domain/member";

const createHouseholdSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Household name is required")
    .max(80, "Keep it under 80 characters"),
});

export async function createHouseholdAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const parsed = createHouseholdSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createHousehold(supabase, {
      name: parsed.data.name,
      createdBy: user.id,
    });
  } catch {
    return { error: "Could not create household" };
  }

  revalidatePath("/household");
  redirect("/household");
}

const addMemberSchema = z.object({
  householdId: z.string().uuid(),
  email: z.string().trim().email("Enter a valid email address"),
  role: z.enum(["admin", "member", "observer"]).default("member"),
});

export async function addHouseholdMemberAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = addMemberSchema.safeParse({
    householdId: formData.get("householdId"),
    email: formData.get("email"),
    role: formData.get("role") || "member",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await addHouseholdMemberByEmail(supabase, parsed.data);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not add member",
    };
  }

  revalidatePath("/household");
  revalidatePath("/household/members");
  return { success: true };
}

const presentationSchema = z.object({
  householdId: z.string().uuid(),
  displayName: z.string().trim().min(1, "Display name is required").max(80),
  memberColor: z
    .string()
    .regex(MEMBER_COLOR_PATTERN, "Invalid member color")
    .transform((value) => value.toUpperCase()),
});

export async function updateMemberPresentationAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const parsed = presentationSchema.safeParse({
    householdId: formData.get("householdId"),
    displayName: formData.get("displayName"),
    memberColor: formData.get("memberColor"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    await updateOwnMemberPresentation(supabase, parsed.data);
  } catch (error) {
    logDatabaseErrorInDev("updateMemberPresentationAction failed", error);
    return { error: "Could not update member" };
  }
  revalidatePath("/household/members");
  revalidatePath("/household");
  return {};
}

const roleSchema = z.object({
  householdId: z.string().uuid(),
  memberId: z.string().uuid(),
  role: z.enum(["admin", "member", "observer"]),
});

export async function changeMemberRoleAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const parsed = roleSchema.safeParse({
    householdId: formData.get("householdId"),
    memberId: formData.get("memberId"),
    role: formData.get("role"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    await changeMemberRole(supabase, parsed.data);
  } catch (error) {
    logDatabaseErrorInDev("changeMemberRoleAction failed", error);
    return { error: "Could not change role" };
  }
  revalidatePath("/household/members");
  revalidatePath("/household");
  return { success: true };
}

const removeMemberSchema = z.object({
  householdId: z.string().uuid(),
  memberId: z.string().uuid(),
});

export async function removeHouseholdMemberAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const parsed = removeMemberSchema.safeParse({
    householdId: formData.get("householdId"),
    memberId: formData.get("memberId"),
  });
  if (!parsed.success) return { error: "ข้อมูลสมาชิกไม่ถูกต้อง" };
  try {
    await removeHouseholdMember(supabase, parsed.data);
  } catch (error) {
    logDatabaseErrorInDev("removeHouseholdMemberAction failed", error);
    return { error: "ลบสมาชิกไม่สำเร็จ โปรดตรวจสอบสิทธิ์และลองอีกครั้ง" };
  }
  revalidatePath("/", "layout");
  return { success: true };
}
