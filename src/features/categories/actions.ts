"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMyPrimaryHousehold } from "@/features/household/api";
import { getWallet } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";

import { archiveCategory, createCategory, renameCategory, restoreCategory } from "./api";

// Two ways to call this action, matching the two places a category can be
// created from:
//  - from the standalone /categories management screen: `scope` alone,
//    resolved against the user's own id (PERSONAL) or their primary
//    household (HOUSEHOLD) — see docs/ARCHITECTURE.md "Milestone 1
//    simplifications" for why "primary household" specifically.
//  - from the transaction form's inline category picker: `walletId`.
//    scope/owner_user_id/household_id are derived from that wallet, loaded
//    server-side through RLS, NOT from a client-supplied `scope` value —
//    a wallet's owning household is not necessarily the user's "primary"
//    one, since the data model supports belonging to several.
const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(60, "Keep it under 60 characters"),
  transactionType: z.enum(["INCOME", "EXPENSE"]),
  // A root category's parentId arrives as "" from a <select> with an empty
  // option (AddCategoryForm) or is simply absent (CategoryPicker only sets
  // the field when adding a subcategory) — normalize both to null BEFORE
  // UUID validation runs. Without the preprocess step, "".uuid() fails
  // validation outright (an empty string is never a valid UUID), so every
  // root-category creation was rejected as "Invalid uuid" before reaching
  // the `|| null` fallback that was supposed to handle exactly this case.
  // Non-empty values still go through full z.string().uuid() validation —
  // this only widens what counts as "no parent", not what counts as a
  // valid parent id.
  parentId: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.string().uuid("Invalid parent category").nullable(),
  ),
  walletId: z
    .string()
    .uuid()
    .nullish()
    .transform((v) => v || null),
  scope: z.enum(["PERSONAL", "HOUSEHOLD"]).nullish(),
});

export async function createCategoryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const parsed = createCategorySchema.safeParse({
    name: formData.get("name"),
    transactionType: formData.get("transactionType"),
    parentId: formData.get("parentId"),
    walletId: formData.get("walletId"),
    scope: formData.get("scope"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let scope: "PERSONAL" | "HOUSEHOLD";
  let ownerUserId: string | null;
  let householdId: string | null;

  if (parsed.data.walletId) {
    const wallet = await getWallet(supabase, parsed.data.walletId);
    if (!wallet) {
      return { error: "Wallet not found or not accessible" };
    }
    scope = wallet.scope;
    ownerUserId = wallet.owner_user_id;
    householdId = wallet.household_id;
  } else if (parsed.data.scope === "HOUSEHOLD") {
    const household = await getMyPrimaryHousehold(supabase, user.id);
    if (!household) {
      return { error: "Create a household first before adding a household category" };
    }
    scope = "HOUSEHOLD";
    ownerUserId = null;
    householdId = household.id;
  } else if (parsed.data.scope === "PERSONAL") {
    scope = "PERSONAL";
    ownerUserId = user.id;
    householdId = null;
  } else {
    return { error: "Missing wallet or scope" };
  }

  try {
    await createCategory(supabase, {
      name: parsed.data.name,
      transactionType: parsed.data.transactionType,
      parentId: parsed.data.parentId,
      scope,
      ownerUserId,
      householdId,
      createdBy: user.id,
    });
  } catch (err) {
    logDatabaseErrorInDev("createCategory failed", err);
    return { error: "Could not create category" };
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
    logDatabaseErrorInDev("renameCategory failed", err);
    return { error: "Could not rename category" };
  }

  revalidatePath("/categories");
  return {};
}
