"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";
import type { ActionState } from "@/lib/types/action-state";

import { archiveCategory, createCategory, renameCategory, restoreCategory } from "./api";

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(60, "Keep it under 60 characters"),
  transactionType: z.enum(["INCOME", "EXPENSE"]),
  parentId: z
    .string()
    .uuid()
    .nullish()
    .transform((v) => v || null),
  scope: z.enum(["PERSONAL", "HOUSEHOLD"]),
});

export async function createCategoryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const parsed = createCategorySchema.safeParse({
    name: formData.get("name"),
    transactionType: formData.get("transactionType"),
    parentId: formData.get("parentId"),
    scope: formData.get("scope"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let householdId: string | null = null;
  if (parsed.data.scope === "HOUSEHOLD") {
    const household = await getMyPrimaryHousehold(supabase, user.id);
    if (!household) {
      return { error: "Create a household first before adding a household category" };
    }
    householdId = household.id;
  }

  try {
    await createCategory(supabase, {
      name: parsed.data.name,
      transactionType: parsed.data.transactionType,
      parentId: parsed.data.parentId,
      scope: parsed.data.scope,
      ownerUserId: parsed.data.scope === "PERSONAL" ? user.id : null,
      householdId,
      createdBy: user.id,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create category" };
  }

  revalidatePath("/categories");
  return {};
}

const idSchema = z.string().uuid();

export async function archiveCategoryAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  await archiveCategory(supabase, id);
  revalidatePath("/categories");
}

export async function restoreCategoryAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  await restoreCategory(supabase, id);
  revalidatePath("/categories");
}

const renameSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Category name is required").max(60, "Keep it under 60 characters"),
});

export async function renameCategoryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = renameSchema.safeParse({ id: formData.get("id"), name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await renameCategory(supabase, parsed.data.id, parsed.data.name);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not rename category" };
  }

  revalidatePath("/categories");
  return {};
}
