"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { FINANCE_RETURN_TO } from "@/features/finance/domain/finance";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { getWallet } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";
import { normalizeAmount, positiveAmountSchema } from "@/lib/validation/money";

import { archiveTemplate, createTemplate, restoreTemplate, setTemplateTags, updateTemplate } from "./api";

const optionalText = z
  .string()
  .trim()
  .max(200)
  .nullish()
  .transform((v) => (v ? v : null));

const optionalAmount = positiveAmountSchema.nullish().transform((v) => (v ? v : null));

const optionalUuid = z
  .string()
  .uuid()
  .nullish()
  .transform((v) => v || null);

const tagIdsSchema = z.array(z.string().uuid("Invalid tag")).max(20, "Too many tags");

// Two ways to resolve scope, same dual path already used by
// createCategoryAction/createTagAction: `walletId` (derives scope/owner/
// household from that wallet — used when the create form is opened with
// a Wallet already selected) or a bare `scope` (resolved against the
// user's own id / their primary household).
const createTemplateSchema = z.object({
  transactionType: z.enum(["INCOME", "EXPENSE"]),
  name: z.string().trim().min(1, "Template name is required").max(60, "Keep it under 60 characters"),
  scope: z.enum(["PERSONAL", "HOUSEHOLD"]).nullish(),
  walletId: optionalUuid,
  pocketId: optionalUuid,
  categoryId: optionalUuid,
  amount: optionalAmount,
  title: optionalText,
  note: optionalText,
  tagIds: tagIdsSchema,
});

async function resolveScope(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  input: { scope?: "PERSONAL" | "HOUSEHOLD" | null; walletId: string | null },
): Promise<{ scope: "PERSONAL" | "HOUSEHOLD"; ownerUserId: string | null; householdId: string | null } | { error: string }> {
  if (input.walletId) {
    const wallet = await getWallet(supabase, input.walletId);
    if (!wallet) return { error: "Wallet not found or not accessible" };
    return { scope: wallet.scope, ownerUserId: wallet.owner_user_id, householdId: wallet.household_id };
  }
  if (input.scope === "HOUSEHOLD") {
    const household = await getMyPrimaryHousehold(supabase, userId);
    if (!household) return { error: "Create a household first before adding a household Template" };
    return { scope: "HOUSEHOLD", ownerUserId: null, householdId: household.id };
  }
  return { scope: "PERSONAL", ownerUserId: userId, householdId: null };
}

export async function createTemplateAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const parsed = createTemplateSchema.safeParse({
    transactionType: formData.get("transactionType"),
    name: formData.get("name"),
    scope: formData.get("scope"),
    walletId: formData.get("walletId"),
    pocketId: formData.get("pocketId"),
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    title: formData.get("title"),
    note: formData.get("note"),
    tagIds: formData.getAll("tagIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const resolved = await resolveScope(supabase, user.id, { scope: parsed.data.scope, walletId: parsed.data.walletId });
  if ("error" in resolved) return { error: resolved.error };

  let templateId: string;
  try {
    const template = await createTemplate(supabase, {
      scope: resolved.scope,
      ownerUserId: resolved.ownerUserId,
      householdId: resolved.householdId,
      transactionType: parsed.data.transactionType,
      name: parsed.data.name,
      walletId: parsed.data.walletId,
      pocketId: parsed.data.pocketId,
      categoryId: parsed.data.categoryId,
      amount: parsed.data.amount ? normalizeAmount(parsed.data.amount) : null,
      title: parsed.data.title,
      note: parsed.data.note,
      createdBy: user.id,
    });
    templateId = template.id;
  } catch (err) {
    logDatabaseErrorInDev("createTemplate failed", err);
    return { error: "สร้าง Template ไม่สำเร็จ — ชื่ออาจซ้ำ หรือ Wallet/Pocket/Category ไม่ถูกต้อง" };
  }

  if (parsed.data.tagIds.length > 0) {
    try {
      await setTemplateTags(supabase, templateId, parsed.data.tagIds);
    } catch (err) {
      // The Template itself was created successfully — tags are a
      // secondary step with no accounting stakes (docs/FINANCE.md Phase
      // F "Tag handling"). Surface the problem but don't lose the
      // Template; the user can fix tags from the detail page.
      logDatabaseErrorInDev("setTemplateTags (create) failed", err);
    }
  }

  revalidatePath("/finance/templates");
  revalidatePath(FINANCE_RETURN_TO);
  redirect(`/finance/templates/${templateId}`);
}

const updateTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Template name is required").max(60, "Keep it under 60 characters"),
  walletId: optionalUuid,
  pocketId: optionalUuid,
  categoryId: optionalUuid,
  amount: optionalAmount,
  title: optionalText,
  note: optionalText,
  tagIds: tagIdsSchema,
});

export async function updateTemplateAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = updateTemplateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    walletId: formData.get("walletId"),
    pocketId: formData.get("pocketId"),
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    title: formData.get("title"),
    note: formData.get("note"),
    tagIds: formData.getAll("tagIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updateTemplate(supabase, parsed.data.id, {
      name: parsed.data.name,
      walletId: parsed.data.walletId,
      pocketId: parsed.data.pocketId,
      categoryId: parsed.data.categoryId,
      amount: parsed.data.amount ? normalizeAmount(parsed.data.amount) : null,
      title: parsed.data.title,
      note: parsed.data.note,
    });
    await setTemplateTags(supabase, parsed.data.id, parsed.data.tagIds);
  } catch (err) {
    logDatabaseErrorInDev("updateTemplate failed", err);
    return { error: "แก้ไข Template ไม่สำเร็จ — ชื่ออาจซ้ำ หรือ Wallet/Pocket/Category/Tag ไม่ถูกต้อง" };
  }

  revalidatePath("/finance/templates");
  revalidatePath(`/finance/templates/${parsed.data.id}`);
  revalidatePath(FINANCE_RETURN_TO);
  redirect(`/finance/templates/${parsed.data.id}`);
}

const idSchema = z.string().uuid();

export async function archiveTemplateAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  await archiveTemplate(supabase, id);
  revalidatePath("/finance/templates");
  revalidatePath(FINANCE_RETURN_TO);
}

export async function restoreTemplateAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = idSchema.parse(formData.get("id"));

  try {
    await restoreTemplate(supabase, id);
  } catch (err) {
    logDatabaseErrorInDev("restoreTemplate failed", err);
    return { error: "กู้คืนไม่สำเร็จ — อาจมี Template ที่ใช้งานอยู่แล้วชื่อเดียวกัน" };
  }

  revalidatePath("/finance/templates");
  revalidatePath(FINANCE_RETURN_TO);
  return {};
}
