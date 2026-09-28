"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { FINANCE_RETURN_TO } from "@/features/finance/domain/finance";
import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";
import { normalizeAmount, positiveAmountSchema } from "@/lib/validation/money";
import { parseBangkokDateTimeInput } from "@/lib/date/bangkok";

import {
  createCreditCardCashAdvance,
  createCreditCardCashback,
  createCreditCardPayment,
  listCreditCardAccounts,
  updateCreditCardAccount,
} from "./api";

const optionalText = z
  .string()
  .trim()
  .max(200)
  .transform((value) => value || null);

const cardTransactionSchema = z.object({
  mode: z.enum(["PAYMENT", "CASHBACK", "CASH_ADVANCE"]),
  cardAccountId: z.string().uuid(),
  endpointWalletId: z.string().uuid().nullish(),
  endpointPocketId: z.string().uuid().nullish(),
  amount: positiveAmountSchema,
  note: optionalText,
  occurredAt: z
    .string()
    .min(1)
    .refine((value) => parseBangkokDateTimeInput(value) !== null)
    .transform((value) => parseBangkokDateTimeInput(value)!.toISOString()),
});

export async function createCreditCardTransactionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = cardTransactionSchema.safeParse({
    mode: formData.get("mode"),
    cardAccountId: formData.get("cardAccountId"),
    endpointWalletId: formData.get("endpointWalletId") || null,
    endpointPocketId: formData.get("endpointPocketId") || null,
    amount: formData.get("amount"),
    note: formData.get("note") ?? "",
    occurredAt: formData.get("occurredAt"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }
  if (
    parsed.data.mode !== "CASHBACK" &&
    (!parsed.data.endpointWalletId || !parsed.data.endpointPocketId)
  ) {
    return { error: "กรุณาเลือกกระเป๋าเงิน" };
  }

  const { supabase } = await requireUser();
  const common = {
    cardAccountId: parsed.data.cardAccountId,
    amount: normalizeAmount(parsed.data.amount),
    note: parsed.data.note,
    occurredAt: parsed.data.occurredAt,
  };
  try {
    if (parsed.data.mode === "PAYMENT") {
      await createCreditCardPayment(supabase, {
        ...common,
        fromWalletId: parsed.data.endpointWalletId!,
        fromPocketId: parsed.data.endpointPocketId!,
      });
    } else if (parsed.data.mode === "CASHBACK") {
      await createCreditCardCashback(supabase, common);
    } else {
      await createCreditCardCashAdvance(supabase, {
        ...common,
        toWalletId: parsed.data.endpointWalletId!,
        toPocketId: parsed.data.endpointPocketId!,
      });
    }
  } catch (error) {
    logDatabaseErrorInDev("createCreditCardTransactionAction failed", error);
    return { error: "ไม่สามารถบันทึกรายการบัตรเครดิตได้" };
  }

  revalidatePath(FINANCE_RETURN_TO);
  redirect(FINANCE_RETURN_TO);
}

const creditCardCycleSchema = z.object({
  accountId: z.string().uuid(),
  walletId: z.string().uuid(),
  statementClosingDay: z.coerce.number().int().min(1).max(31),
  paymentDueDay: z.coerce.number().int().min(1).max(31),
});

export async function updateCreditCardCycleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = creditCardCycleSchema.safeParse({
    accountId: formData.get("accountId"),
    walletId: formData.get("walletId"),
    statementClosingDay: formData.get("statementClosingDay"),
    paymentDueDay: formData.get("paymentDueDay"),
  });
  if (!parsed.success) {
    return { error: "กรอกวันตัดยอดและวันครบกำหนดตั้งแต่ 1–31" };
  }

  const { supabase } = await requireUser();
  try {
    const account = (
      await listCreditCardAccounts(supabase, { includeArchived: true })
    ).find(
      (item) =>
        item.accountId === parsed.data.accountId &&
        item.walletId === parsed.data.walletId,
    );
    if (!account) return { error: "ไม่พบบัตรเครดิตนี้" };

    await updateCreditCardAccount(supabase, {
      accountId: account.accountId,
      name: account.name,
      issuer: account.issuer,
      network: account.network,
      lastFour: account.lastFour,
      creditLimit: account.creditLimit,
      statementClosingDay: parsed.data.statementClosingDay,
      paymentDueDay: parsed.data.paymentDueDay,
      apr: account.apr,
    });
  } catch (error) {
    logDatabaseErrorInDev("updateCreditCardCycleAction failed", error);
    return { error: "บันทึกรอบบัตรเครดิตไม่สำเร็จ" };
  }

  revalidatePath(`/wallets/${parsed.data.walletId}`);
  revalidatePath(`/wallets/${parsed.data.walletId}/manage`);
  revalidatePath(FINANCE_RETURN_TO);
  return { success: true };
}
