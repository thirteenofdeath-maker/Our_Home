"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { FINANCE_RETURN_TO } from "@/features/finance/domain/finance";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";
import { normalizeAmount, positiveAmountSchema } from "@/lib/validation/money";

import { archiveBudget, createBudget, restoreBudget, updateBudgetAmount } from "./api";

const createBudgetSchema = z.object({
  scope: z.enum(["PERSONAL", "HOUSEHOLD"]),
  categoryId: z.string().uuid("Choose a category"),
  currency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code, e.g. THB")
    .transform((v) => v.toUpperCase()),
  periodMonth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-01$/, "Invalid period"),
  amount: positiveAmountSchema,
});

export async function createBudgetAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const parsed = createBudgetSchema.safeParse({
    scope: formData.get("scope"),
    categoryId: formData.get("categoryId"),
    currency: formData.get("currency"),
    periodMonth: formData.get("periodMonth"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let ownerUserId: string | null = null;
  let householdId: string | null = null;
  if (parsed.data.scope === "HOUSEHOLD") {
    const household = await getMyPrimaryHousehold(supabase, user.id);
    if (!household) {
      return { error: "Create a household first before adding a household budget" };
    }
    householdId = household.id;
  } else {
    ownerUserId = user.id;
  }

  try {
    await createBudget(supabase, {
      scope: parsed.data.scope,
      ownerUserId,
      householdId,
      categoryId: parsed.data.categoryId,
      currency: parsed.data.currency,
      periodMonth: parsed.data.periodMonth,
      amount: normalizeAmount(parsed.data.amount),
      createdBy: user.id,
    });
  } catch (err) {
    logDatabaseErrorInDev("createBudget failed", err);
    return { error: "สร้างงบประมาณไม่สำเร็จ — อาจมีงบสำหรับหมวดหมู่/สกุลเงิน/เดือนนี้อยู่แล้ว หรือหมวดหมู่ไม่ถูกต้อง" };
  }

  revalidatePath("/finance/budgets");
  revalidatePath(FINANCE_RETURN_TO);
  redirect(`/finance/budgets?month=${parsed.data.periodMonth.slice(0, 7)}`);
}

const idSchema = z.string().uuid();

const updateAmountSchema = z.object({
  id: z.string().uuid(),
  amount: positiveAmountSchema,
});

export async function updateBudgetAmountAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = updateAmountSchema.safeParse({ id: formData.get("id"), amount: formData.get("amount") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updateBudgetAmount(supabase, parsed.data.id, normalizeAmount(parsed.data.amount));
  } catch (err) {
    logDatabaseErrorInDev("updateBudgetAmount failed", err);
    return { error: "แก้ไขจำนวนงบประมาณไม่สำเร็จ" };
  }

  revalidatePath("/finance/budgets");
  revalidatePath(FINANCE_RETURN_TO);
  return {};
}

export async function archiveBudgetAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = idSchema.parse(formData.get("id"));
  await archiveBudget(supabase, id);
  revalidatePath("/finance/budgets");
  revalidatePath(FINANCE_RETURN_TO);
}

export async function restoreBudgetAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = idSchema.parse(formData.get("id"));

  try {
    await restoreBudget(supabase, id);
  } catch (err) {
    logDatabaseErrorInDev("restoreBudget failed", err);
    return { error: "กู้คืนไม่สำเร็จ — อาจมีงบประมาณที่ใช้งานอยู่แล้วสำหรับหมวดหมู่/สกุลเงิน/เดือนนี้" };
  }

  revalidatePath("/finance/budgets");
  revalidatePath(FINANCE_RETURN_TO);
  return {};
}
