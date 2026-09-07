"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import type { ActionState } from "@/lib/types/action-state";
import { normalizeAmount, positiveAmountSchema } from "@/lib/validation/money";

import { createIncomeExpense, createPocketTransfer, createWalletTransfer } from "./api";

const optionalText = z
  .string()
  .trim()
  .max(200)
  .nullish()
  .transform((v) => (v ? v : null));

const incomeExpenseSchema = z.object({
  transactionType: z.enum(["INCOME", "EXPENSE"]),
  walletId: z.string().uuid(),
  pocketId: z.string().uuid(),
  categoryId: z.string().uuid("Choose a category"),
  amount: positiveAmountSchema,
  title: optionalText,
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
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save transaction" };
  }

  revalidatePath(`/wallets/${parsed.data.walletId}`);
  redirect(`/wallets/${parsed.data.walletId}`);
}

const pocketTransferSchema = z.object({
  walletId: z.string().uuid(),
  fromPocketId: z.string().uuid(),
  toPocketId: z.string().uuid(),
  amount: positiveAmountSchema,
  title: optionalText,
});

export async function createPocketTransferAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = pocketTransferSchema.safeParse({
    walletId: formData.get("walletId"),
    fromPocketId: formData.get("fromPocketId"),
    toPocketId: formData.get("toPocketId"),
    amount: formData.get("amount"),
    title: formData.get("title"),
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
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not transfer" };
  }

  revalidatePath(`/wallets/${parsed.data.walletId}`);
  redirect(`/wallets/${parsed.data.walletId}`);
}

const walletTransferSchema = z.object({
  fromWalletId: z.string().uuid(),
  fromPocketId: z.string().uuid(),
  toWalletId: z.string().uuid(),
  toPocketId: z.string().uuid(),
  amount: positiveAmountSchema,
  title: optionalText,
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
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not transfer" };
  }

  revalidatePath(`/wallets/${parsed.data.fromWalletId}`);
  redirect(`/wallets/${parsed.data.fromWalletId}`);
}
