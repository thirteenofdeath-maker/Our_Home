"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import type { ActionState } from "@/lib/types/action-state";

import { addHouseholdMemberByEmail, createHousehold } from "./api";

const createHouseholdSchema = z.object({
  name: z.string().trim().min(1, "Household name is required").max(80, "Keep it under 80 characters"),
});

export async function createHouseholdAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const parsed = createHouseholdSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createHousehold(supabase, { name: parsed.data.name, createdBy: user.id });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create household" };
  }

  revalidatePath("/household");
  redirect("/household");
}

const addMemberSchema = z.object({
  householdId: z.string().uuid(),
  email: z.string().trim().email("Enter a valid email address"),
  role: z.enum(["admin", "member"]).default("member"),
});

export async function addHouseholdMemberAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
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
    return { error: err instanceof Error ? err.message : "Could not add member" };
  }

  revalidatePath("/household");
  return {};
}
