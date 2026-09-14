"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { FINANCE_RETURN_TO } from "@/features/finance/domain/finance";
import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";
import { normalizeAmount, positiveAmountSchema } from "@/lib/validation/money";

import {
  createCreditCardCashAdvance,
  createCreditCardCashback,
  createCreditCardPayment,
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
    .transform((value) => new Date(`${value}T12:00:00`).toISOString()),
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
