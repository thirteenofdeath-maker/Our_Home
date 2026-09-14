"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMyPrimaryHousehold } from "@/features/household/api";
import { FINANCE_RETURN_TO } from "@/features/finance/domain/finance";
import { getWallet } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";

import { archiveTag, createTag, renameTag, restoreTag } from "./api";

// Two ways to call this action, same dual path as createCategoryAction:
//  - from the standalone /finance/tags screen: `scope` alone, resolved
//    against the user's own id (PERSONAL) or their primary household
//    (HOUSEHOLD).
//  - from a transaction form's inline TagPicker "quick create": `walletId`
//    — scope/owner/household come from that wallet (loaded server-side
//    through RLS), never a client-supplied `scope`, since a wallet's
//    owning household is not necessarily the user's "primary" one.
const createTagSchema = z.object({
  name: z.string().trim().min(1, "Tag name is required").max(30, "Keep it under 30 characters"),
  scope: z.enum(["PERSONAL", "HOUSEHOLD"]).nullish(),
  walletId: z
    .string()
    .uuid()
    .nullish()
    .transform((v) => v || null),
});

export async function createTagAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const parsed = createTagSchema.safeParse({
    name: formData.get("name"),
    scope: formData.get("scope"),
    walletId: formData.get("walletId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let scope: "PERSONAL" | "HOUSEHOLD";
  let ownerUserId: string | null = null;
  let householdId: string | null = null;

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
      return { error: "Create a household first before adding a household tag" };
    }
    scope = "HOUSEHOLD";
    householdId = household.id;
  } else if (parsed.data.scope === "PERSONAL") {
    scope = "PERSONAL";
    ownerUserId = user.id;
  } else {
    return { error: "Missing wallet or scope" };
  }

  try {
    await createTag(supabase, { name: parsed.data.name, scope, ownerUserId, householdId, createdBy: user.id });
  } catch (err) {
    logDatabaseErrorInDev("createTag failed", err);
    return { error: "สร้างแท็กไม่สำเร็จ — อาจมีแท็กชื่อนี้อยู่แล้ว" };
  }

  revalidatePath("/finance/tags");
  revalidatePath(FINANCE_RETURN_TO);
  return {};
}

const idSchema = z.string().uuid();

export async function archiveTagAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  await archiveTag(supabase, id);
  revalidatePath("/finance/tags");
}

export async function restoreTagAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  await restoreTag(supabase, id);
  revalidatePath("/finance/tags");
}

const renameSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Tag name is required").max(30, "Keep it under 30 characters"),
});

export async function renameTagAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = renameSchema.safeParse({ id: formData.get("id"), name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await renameTag(supabase, parsed.data.id, parsed.data.name);
  } catch (err) {
    logDatabaseErrorInDev("renameTag failed", err);
    return { error: "เปลี่ยนชื่อแท็กไม่สำเร็จ — อาจมีแท็กชื่อนี้อยู่แล้ว" };
  }

  revalidatePath("/finance/tags");
  return {};
}
