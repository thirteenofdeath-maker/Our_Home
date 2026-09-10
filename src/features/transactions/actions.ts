"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { FINANCE_RETURN_TO } from "@/features/finance/domain/finance";
import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";
import { normalizeAmount, positiveAmountSchema } from "@/lib/validation/money";

import { createIncomeExpense, createPocketTransfer, createWalletTransfer, restoreTransaction, updateIncomeExpense, voidTransaction } from "./api";

/**
 * Tags submit as repeated hidden inputs sharing one field name
 * (TagPicker) — `formData.getAll(...)`, not `.get(...)`. Capped well above
 * any realistic UI use to keep the RPC's validation loop (0032:
 * assign_transaction_tags) bounded.
 */
const tagIdsSchema = z.array(z.string().uuid("Invalid tag")).max(20, "Too many tags");

/**
 * `returnTo` lets the Finance Hub's quick-add links ("Finance -> add ->
 * save -> back to Finance", per docs/ARCHITECTURE.md Finance Hub section)
 * redirect somewhere other than the wallet detail page after a save,
 * without a second transaction writer — this only changes the redirect
 * target. Whitelisted to the one known-safe internal constant rather than
 * accepting an arbitrary path, so there is no open-redirect surface to
 * reason about at all.
 */
const returnToSchema = z
  .string()
  .nullish()
  .transform((value) => (value === FINANCE_RETURN_TO ? FINANCE_RETURN_TO : null));

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

const incomeExpenseSchema = z.object({
  transactionType: z.enum(["INCOME", "EXPENSE"]),
  walletId: z.string().uuid(),
  pocketId: z.string().uuid(),
  categoryId: z.string().uuid("Choose a category"),
  amount: positiveAmountSchema,
  title: optionalText,
  note: optionalText,
  occurredAt: occurredAtSchema,
  returnTo: returnToSchema,
  tagIds: tagIdsSchema,
});

export async function createIncomeExpenseAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = incomeExpenseSchema.safeParse({
    transactionType: formData.get("transactionType"),
    walletId: formData.get("walletId"),
    pocketId: formData.get("pocketId"),
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    title: formData.get("title"),
    note: formData.get("note"),
    occurredAt: formData.get("occurredAt"),
    returnTo: formData.get("returnTo"),
    tagIds: formData.getAll("tagIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createIncomeExpense(supabase, {
      transactionType: parsed.data.transactionType,
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
    logDatabaseErrorInDev("createIncomeExpenseAction failed", err);
    return { error: "Could not save transaction" };
  }

  revalidatePath(`/wallets/${parsed.data.walletId}`);
  revalidatePath(FINANCE_RETURN_TO);
  redirect(parsed.data.returnTo ?? `/wallets/${parsed.data.walletId}`);
}

const pocketTransferSchema = z.object({
  walletId: z.string().uuid(),
  fromPocketId: z.string().uuid(),
  toPocketId: z.string().uuid(),
  amount: positiveAmountSchema,
  title: optionalText,
  note: optionalText,
  occurredAt: occurredAtSchema,
  tagIds: tagIdsSchema,
});

export async function createPocketTransferAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = pocketTransferSchema.safeParse({
    walletId: formData.get("walletId"),
    fromPocketId: formData.get("fromPocketId"),
    toPocketId: formData.get("toPocketId"),
    amount: formData.get("amount"),
    title: formData.get("title"),
    note: formData.get("note"),
    occurredAt: formData.get("occurredAt"),
    tagIds: formData.getAll("tagIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (parsed.data.fromPocketId === parsed.data.toPocketId) {
    return { error: "Choose two different pockets" };
  }

  try {
    await createPocketTransfer(supabase, {
      walletId: parsed.data.walletId,
      fromPocketId: parsed.data.fromPocketId,
      toPocketId: parsed.data.toPocketId,
      amount: normalizeAmount(parsed.data.amount),
      title: parsed.data.title,
      note: parsed.data.note,
      occurredAt: parsed.data.occurredAt,
      tagIds: parsed.data.tagIds,
    });
  } catch (err) {
    logDatabaseErrorInDev("createPocketTransferAction failed", err);
    return { error: "Could not transfer" };
  }

  revalidatePath(`/wallets/${parsed.data.walletId}`);
  revalidatePath(FINANCE_RETURN_TO);
  redirect(`/wallets/${parsed.data.walletId}`);
}

const walletTransferSchema = z.object({
  fromWalletId: z.string().uuid(),
  fromPocketId: z.string().uuid(),
  toWalletId: z.string().uuid(),
  toPocketId: z.string().uuid(),
  amount: positiveAmountSchema,
  title: optionalText,
  note: optionalText,
  occurredAt: occurredAtSchema,
  tagIds: tagIdsSchema,
});

export async function createWalletTransferAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = walletTransferSchema.safeParse({
    fromWalletId: formData.get("fromWalletId"),
    fromPocketId: formData.get("fromPocketId"),
    toWalletId: formData.get("toWalletId"),
    toPocketId: formData.get("toPocketId"),
    amount: formData.get("amount"),
    title: formData.get("title"),
    note: formData.get("note"),
    occurredAt: formData.get("occurredAt"),
    tagIds: formData.getAll("tagIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (parsed.data.fromWalletId === parsed.data.toWalletId) {
    return { error: "Choose two different wallets (use a pocket transfer within one wallet instead)" };
  }

  try {
    await createWalletTransfer(supabase, {
      fromWalletId: parsed.data.fromWalletId,
      fromPocketId: parsed.data.fromPocketId,
      toWalletId: parsed.data.toWalletId,
      toPocketId: parsed.data.toPocketId,
      amount: normalizeAmount(parsed.data.amount),
      title: parsed.data.title,
      note: parsed.data.note,
      occurredAt: parsed.data.occurredAt,
      tagIds: parsed.data.tagIds,
    });
  } catch (err) {
    logDatabaseErrorInDev("createWalletTransferAction failed", err);
    return { error: "Could not transfer" };
  }

  revalidatePath(`/wallets/${parsed.data.fromWalletId}`);
  revalidatePath(FINANCE_RETURN_TO);
  redirect(`/wallets/${parsed.data.fromWalletId}`);
}

// ---------------------------------------------------------------------
// Phase B: edit / void / restore. INCOME/EXPENSE only — transfers remain
// immutable in this phase (see docs/FINANCE.md Phase B). `walletId` is
// carried as a hidden field purely so this action knows which wallet
// detail route to revalidate; it is never sent to the RPC (the wallet
// itself is not editable, and update_income_expense_transaction (0031)
// derives it from the transaction's existing entry, not from the client).
// ---------------------------------------------------------------------

const editIncomeExpenseSchema = z.object({
  transactionId: z.string().uuid(),
  walletId: z.string().uuid(),
  pocketId: z.string().uuid(),
  categoryId: z.string().uuid("Choose a category"),
  amount: positiveAmountSchema,
  title: optionalText,
  note: optionalText,
  occurredAt: occurredAtSchema,
  // Always sent by EditTransactionForm's TagPicker as the full desired
  // tag set (possibly empty) — see updateIncomeExpense in api.ts: an
  // array here always means "replace with exactly this", never "leave
  // unchanged" (that's what omitting the field entirely is for, which
  // this action never does).
  tagIds: tagIdsSchema,
});

export async function updateIncomeExpenseAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = editIncomeExpenseSchema.safeParse({
    transactionId: formData.get("transactionId"),
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
    await updateIncomeExpense(supabase, {
      transactionId: parsed.data.transactionId,
      pocketId: parsed.data.pocketId,
      categoryId: parsed.data.categoryId,
      amount: normalizeAmount(parsed.data.amount),
      title: parsed.data.title,
      note: parsed.data.note,
      occurredAt: parsed.data.occurredAt,
      tagIds: parsed.data.tagIds,
    });
  } catch (err) {
    logDatabaseErrorInDev("updateIncomeExpenseAction failed", err);
    return { error: "ไม่สามารถบันทึกการแก้ไขได้" };
  }

  revalidatePath(`/wallets/${parsed.data.walletId}`);
  revalidatePath(`/finance/transactions/${parsed.data.transactionId}`);
  revalidatePath("/finance/transactions");
  revalidatePath(FINANCE_RETURN_TO);
  redirect(`/finance/transactions/${parsed.data.transactionId}`);
}

const voidTransactionSchema = z.object({
  transactionId: z.string().uuid(),
  walletId: z.string().uuid(),
  voidReason: optionalText,
});

// useActionState-shaped: voiding can genuinely fail (already voided, a
// transfer, no longer authorized) and the user must see why.
export async function voidTransactionAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = voidTransactionSchema.safeParse({
    transactionId: formData.get("transactionId"),
    walletId: formData.get("walletId"),
    voidReason: formData.get("voidReason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await voidTransaction(supabase, parsed.data.transactionId, parsed.data.voidReason);
  } catch (err) {
    logDatabaseErrorInDev("voidTransactionAction failed", err);
    return { error: "ไม่สามารถยกเลิกรายการได้" };
  }

  revalidatePath(`/wallets/${parsed.data.walletId}`);
  revalidatePath(`/finance/transactions/${parsed.data.transactionId}`);
  revalidatePath("/finance/transactions");
  revalidatePath(FINANCE_RETURN_TO);
  return {};
}

const restoreTransactionSchema = z.object({
  transactionId: z.string().uuid(),
  walletId: z.string().uuid(),
});

// useActionState-shaped: restore can fail with a business reason (the
// wallet/pocket is archived) that the user must see, not have swallowed.
export async function restoreTransactionAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = restoreTransactionSchema.safeParse({
    transactionId: formData.get("transactionId"),
    walletId: formData.get("walletId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await restoreTransaction(supabase, parsed.data.transactionId);
  } catch (err) {
    logDatabaseErrorInDev("restoreTransactionAction failed", err);
    return { error: "ไม่สามารถกู้คืนรายการได้ — กระเป๋าเงินหรือช่องอาจถูกเก็บถาวรอยู่" };
  }

  revalidatePath(`/wallets/${parsed.data.walletId}`);
  revalidatePath(`/finance/transactions/${parsed.data.transactionId}`);
  revalidatePath("/finance/transactions");
  revalidatePath(FINANCE_RETURN_TO);
  return {};
}
