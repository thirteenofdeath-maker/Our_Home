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

import {
  archiveRecurringTransaction,
  createRecurringTransaction,
  pauseRecurringTransaction,
  postRecurringOccurrence,
  resumeRecurringTransaction,
  restoreRecurringTransaction,
  setRecurringTransactionTags,
  skipRecurringOccurrence,
  updateRecurringTransaction,
} from "./api";

const optionalText = z
  .string()
  .trim()
  .max(200)
  .nullish()
  .transform((v) => (v ? v : null));

const optionalUuid = z
  .string()
  .uuid()
  .nullish()
  .transform((v) => v || null);

const tagIdsSchema = z.array(z.string().uuid("Invalid tag")).max(20, "Too many tags");

const dateStringSchema = z
  .string()
  .trim()
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)), "Choose a valid date");

const scheduleFields = {
  frequency: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]),
  intervalCount: z.coerce.number().int().min(1, "ต้องมากกว่าหรือเท่ากับ 1"),
  startDate: dateStringSchema,
  endDate: dateStringSchema.nullish().transform((v) => v || null),
};

function validateSchedule<T extends { startDate: string; endDate: string | null }>(data: T, ctx: z.RefinementCtx) {
  if (data.endDate && data.endDate < data.startDate) {
    ctx.addIssue({ code: "custom", message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น", path: ["endDate"] });
  }
}

// Two ways to resolve scope, same dual path as createTemplateAction.
const createRecurringSchema = z
  .object({
    transactionType: z.enum(["INCOME", "EXPENSE"]),
    name: z.string().trim().min(1, "กรุณาระบุชื่อรายการประจำ").max(60, "Keep it under 60 characters"),
    scope: z.enum(["PERSONAL", "HOUSEHOLD"]).nullish(),
    walletId: optionalUuid,
    pocketId: optionalUuid,
    categoryId: optionalUuid,
    amount: positiveAmountSchema,
    title: optionalText,
    note: optionalText,
    tagIds: tagIdsSchema,
    ...scheduleFields,
  })
  .superRefine(validateSchedule);

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
    if (!household) return { error: "สร้างครอบครัวก่อนเพิ่มรายการประจำของครอบครัว" };
    return { scope: "HOUSEHOLD", ownerUserId: null, householdId: household.id };
  }
  return { scope: "PERSONAL", ownerUserId: userId, householdId: null };
}

export async function createRecurringAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const parsed = createRecurringSchema.safeParse({
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
    frequency: formData.get("frequency"),
    intervalCount: formData.get("intervalCount"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const resolved = await resolveScope(supabase, user.id, { scope: parsed.data.scope, walletId: parsed.data.walletId });
  if ("error" in resolved) return { error: resolved.error };

  let recurringId: string;
  try {
    const rule = await createRecurringTransaction(supabase, {
      scope: resolved.scope,
      ownerUserId: resolved.ownerUserId,
      householdId: resolved.householdId,
      transactionType: parsed.data.transactionType,
      name: parsed.data.name,
      walletId: parsed.data.walletId,
      pocketId: parsed.data.pocketId,
      categoryId: parsed.data.categoryId,
      amount: normalizeAmount(parsed.data.amount),
      title: parsed.data.title,
      note: parsed.data.note,
      frequency: parsed.data.frequency,
      intervalCount: parsed.data.intervalCount,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      createdBy: user.id,
    });
    recurringId = rule.id;
  } catch (err) {
    logDatabaseErrorInDev("createRecurringTransaction failed", err);
    return { error: "สร้างรายการประจำไม่สำเร็จ — Wallet/Pocket/Category ไม่ถูกต้อง หรือวันที่ไม่ถูกต้อง" };
  }

  if (parsed.data.tagIds.length > 0) {
    try {
      await setRecurringTransactionTags(supabase, recurringId, parsed.data.tagIds);
    } catch (err) {
      // No accounting stakes — same reasoning as Template tag creation
      // (docs/FINANCE.md Phase F "Tag handling"): the rule was created
      // successfully, tags are a secondary step.
      logDatabaseErrorInDev("setRecurringTransactionTags (create) failed", err);
    }
  }

  revalidatePath("/finance/recurring");
  revalidatePath(FINANCE_RETURN_TO);
  redirect(`/finance/recurring/${recurringId}`);
}

const updateRecurringSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1, "กรุณาระบุชื่อรายการประจำ").max(60, "Keep it under 60 characters"),
    walletId: optionalUuid,
    pocketId: optionalUuid,
    categoryId: optionalUuid,
    amount: positiveAmountSchema,
    title: optionalText,
    note: optionalText,
    tagIds: tagIdsSchema,
    ...scheduleFields,
  })
  .superRefine(validateSchedule);

export async function updateRecurringAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = updateRecurringSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    walletId: formData.get("walletId"),
    pocketId: formData.get("pocketId"),
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    title: formData.get("title"),
    note: formData.get("note"),
    tagIds: formData.getAll("tagIds"),
    frequency: formData.get("frequency"),
    intervalCount: formData.get("intervalCount"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updateRecurringTransaction(supabase, parsed.data.id, {
      name: parsed.data.name,
      walletId: parsed.data.walletId,
      pocketId: parsed.data.pocketId,
      categoryId: parsed.data.categoryId,
      amount: normalizeAmount(parsed.data.amount),
      title: parsed.data.title,
      note: parsed.data.note,
      frequency: parsed.data.frequency,
      intervalCount: parsed.data.intervalCount,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
    });
    await setRecurringTransactionTags(supabase, parsed.data.id, parsed.data.tagIds);
  } catch (err) {
    logDatabaseErrorInDev("updateRecurringTransaction failed", err);
    return { error: "แก้ไขรายการประจำไม่สำเร็จ — Wallet/Pocket/Category/Tag หรือวันที่ไม่ถูกต้อง" };
  }

  revalidatePath("/finance/recurring");
  revalidatePath(`/finance/recurring/${parsed.data.id}`);
  revalidatePath(FINANCE_RETURN_TO);
  redirect(`/finance/recurring/${parsed.data.id}`);
}

const idSchema = z.string().uuid();

export async function pauseRecurringAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  await pauseRecurringTransaction(supabase, id);
  revalidatePath("/finance/recurring");
  revalidatePath(`/finance/recurring/${id}`);
  revalidatePath(FINANCE_RETURN_TO);
}

export async function archiveRecurringAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  await archiveRecurringTransaction(supabase, id);
  revalidatePath("/finance/recurring");
  revalidatePath(`/finance/recurring/${id}`);
  revalidatePath(FINANCE_RETURN_TO);
}

// useActionState-shaped: resuming/restoring can fail (rare, but the
// reactivation trigger's generation call could raise) and the user
// must see why rather than have it swallowed.
export async function resumeRecurringAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = idSchema.parse(formData.get("id"));

  try {
    await resumeRecurringTransaction(supabase, id);
  } catch (err) {
    logDatabaseErrorInDev("resumeRecurringTransaction failed", err);
    return { error: "ไม่สามารถเปิดใช้งานรายการประจำได้" };
  }

  revalidatePath("/finance/recurring");
  revalidatePath(`/finance/recurring/${id}`);
  revalidatePath(FINANCE_RETURN_TO);
  return {};
}

export async function restoreRecurringAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = idSchema.parse(formData.get("id"));

  try {
    await restoreRecurringTransaction(supabase, id);
  } catch (err) {
    logDatabaseErrorInDev("restoreRecurringTransaction failed", err);
    return { error: "ไม่สามารถกู้คืนรายการประจำได้" };
  }

  revalidatePath("/finance/recurring");
  revalidatePath(`/finance/recurring/${id}`);
  revalidatePath(FINANCE_RETURN_TO);
  return {};
}

export async function skipOccurrenceAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const occurrenceId = idSchema.parse(formData.get("occurrenceId"));
  const recurringId = idSchema.parse(formData.get("recurringId"));

  try {
    await skipRecurringOccurrence(supabase, occurrenceId);
  } catch (err) {
    logDatabaseErrorInDev("skipRecurringOccurrence failed", err);
    return { error: "ไม่สามารถข้ามรายการนี้ได้ — อาจถูกบันทึกหรือข้ามไปแล้ว" };
  }

  revalidatePath(`/finance/recurring/${recurringId}`);
  revalidatePath("/finance/recurring");
  revalidatePath(FINANCE_RETURN_TO);
  return {};
}

// ---------------------------------------------------------------------
// Posting an occurrence — called by TransactionForm when rendered with
// its `postOccurrence` prop (see transactions/components/
// TransactionForm.tsx), instead of createIncomeExpenseAction. Reuses
// the same field set/shape but routes through post_recurring_occurrence
// (0036) so the ledger write and the occurrence's UPCOMING -> POSTED
// transition happen atomically (docs/FINANCE.md Phase G "Atomic posting").
// ---------------------------------------------------------------------

const occurredAtSchema = z
  .string()
  .trim()
  .min(1, "Choose a date")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Choose a valid date")
  .transform((value) => new Date(`${value}T12:00:00`).toISOString());

const postOccurrenceSchema = z.object({
  occurrenceId: z.string().uuid(),
  walletId: z.string().uuid(),
  pocketId: z.string().uuid(),
  categoryId: z.string().uuid("Choose a category"),
  amount: positiveAmountSchema,
  title: optionalText,
  note: optionalText,
  occurredAt: occurredAtSchema,
  tagIds: tagIdsSchema,
});

export async function postRecurringOccurrenceAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = postOccurrenceSchema.safeParse({
    occurrenceId: formData.get("occurrenceId"),
    walletId: formData.get("walletId"),
    pocketId: formData.get("pocketId"),
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    title: formData.get("title"),
    note: formData.get("note"),
    occurredAt: formData.get("occurredAt"),
    tagIds: formData.getAll("tagIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await postRecurringOccurrence(supabase, {
      occurrenceId: parsed.data.occurrenceId,
      walletId: parsed.data.walletId,
      pocketId: parsed.data.pocketId,
      categoryId: parsed.data.categoryId,
      amount: normalizeAmount(parsed.data.amount),
      title: parsed.data.title,
      note: parsed.data.note,
      occurredAt: parsed.data.occurredAt,
      tagIds: parsed.data.tagIds,
    });
  } catch (err) {
    logDatabaseErrorInDev("postRecurringOccurrenceAction failed", err);
    return { error: "ไม่สามารถบันทึกรายการได้ — อาจถูกบันทึกไปแล้ว หรือ Wallet/Pocket/Category ไม่ถูกต้อง" };
  }

  revalidatePath("/finance/recurring");
  revalidatePath(FINANCE_RETURN_TO);
  redirect(FINANCE_RETURN_TO);
}
