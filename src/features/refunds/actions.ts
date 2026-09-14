"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { FINANCE_RETURN_TO } from "@/features/finance/domain/finance";
import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";
import { normalizeAmount, positiveAmountSchema } from "@/lib/validation/money";

import { createExpenseAdjustment } from "./api";

// Void/restore reuse the existing generic transactions/actions.ts actions
// unchanged — a refund/reimbursement is stored as an ordinary transaction,
// so Phase B's void/restore Server Actions already work for it (the extra
// refund-aware business rules live in the DB RPCs, see 0033). This file
// only adds the one thing Phase B has no equivalent for: creating the
// adjustment itself.

const optionalText = z
  .string()
  .trim()
  .max(200)
  .nullish()
  .transform((v) => (v ? v : null));

const occurredAtSchema = z
  .string()
  .trim()
  .min(1, "Choose a date")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Choose a valid date")
  .transform((value) => new Date(`${value}T12:00:00`).toISOString());

const tagIdsSchema = z.array(z.string().uuid("Invalid tag")).max(20, "Too many tags");

const createAdjustmentSchema = z.object({
  originalExpenseId: z.string().uuid(),
  adjustmentKind: z.enum(["REFUND", "REIMBURSEMENT"]),
  walletId: z.string().uuid(),
  pocketId: z.string().uuid(),
  amount: positiveAmountSchema,
  title: optionalText,
  note: optionalText,
  occurredAt: occurredAtSchema,
  tagIds: tagIdsSchema,
});

export async function createExpenseAdjustmentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = createAdjustmentSchema.safeParse({
    originalExpenseId: formData.get("originalExpenseId"),
    adjustmentKind: formData.get("adjustmentKind"),
    walletId: formData.get("walletId"),
    pocketId: formData.get("pocketId"),
    amount: formData.get("amount"),
    title: formData.get("title"),
    note: formData.get("note"),
    occurredAt: formData.get("occurredAt"),
    tagIds: formData.getAll("tagIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let transactionId: string;
  try {
    transactionId = await createExpenseAdjustment(supabase, {
      originalExpenseId: parsed.data.originalExpenseId,
      adjustmentKind: parsed.data.adjustmentKind,
      walletId: parsed.data.walletId,
      pocketId: parsed.data.pocketId,
      amount: normalizeAmount(parsed.data.amount),
      title: parsed.data.title,
      note: parsed.data.note,
      occurredAt: parsed.data.occurredAt,
      tagIds: parsed.data.tagIds,
    });
  } catch (err) {
    logDatabaseErrorInDev("createExpenseAdjustmentAction failed", err);
    // The DB is the source of truth for the refund cap / currency / scope
    // / archived-dependency checks — surface its rejection rather than a
    // generic message, same reasoning as updateWallet's currency error.
    return { error: "ไม่สามารถบันทึกรายการคืนเงิน/เบิกคืนได้ — ตรวจสอบยอดคงเหลือที่คืนได้ สกุลเงิน และกระเป๋าเงินปลายทาง" };
  }

  revalidatePath(`/finance/transactions/${parsed.data.originalExpenseId}`);
  revalidatePath(`/finance/transactions/${transactionId}`);
  revalidatePath("/finance/transactions");
  revalidatePath(FINANCE_RETURN_TO);
  redirect(`/finance/transactions/${transactionId}`);
}
