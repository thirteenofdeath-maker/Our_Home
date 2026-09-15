"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";
import { normalizeAmount, positiveAmountSchema } from "@/lib/validation/money";

const uuid = z.string().uuid();
const nonnegativeAmount = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/);

export async function createDebtAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const parsed = z
    .object({
      scope: z.enum(["PERSONAL", "HOUSEHOLD"]),
      debtType: z.enum(["LIABILITY", "RECEIVABLE"]),
      name: z.string().trim().min(1),
      counterparty: z.string(),
      currency: z.string().regex(/^[A-Z]{3}$/),
      principal: positiveAmountSchema,
      walletId: uuid,
      pocketId: uuid,
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: "ข้อมูลไม่ถูกต้อง" };

  const household =
    parsed.data.scope === "HOUSEHOLD"
      ? await getMyPrimaryHousehold(supabase, user.id)
      : null;
  const { data, error } = await supabase.rpc("create_debt_account", {
    p_scope: parsed.data.scope,
    p_household_id: household?.id ?? null,
    p_debt_type: parsed.data.debtType,
    p_name: parsed.data.name,
    p_counterparty: parsed.data.counterparty,
    p_currency: parsed.data.currency,
    p_opening_principal: normalizeAmount(parsed.data.principal),
    p_wallet_id: parsed.data.walletId,
    p_pocket_id: parsed.data.pocketId,
  });

  if (error) {
    logDatabaseErrorInDev("createDebt failed", error);
    return { error: "สร้างหนี้ไม่สำเร็จ" };
  }
  redirect(`/finance/debts/${data}`);
}

export async function recordDebtPaymentAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const parsed = z
    .object({
      debtId: uuid,
      walletId: uuid,
      pocketId: uuid,
      categoryId: uuid,
      principal: positiveAmountSchema,
      interest: nonnegativeAmount,
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: "ข้อมูลไม่ถูกต้อง" };

  const { error } = await supabase.rpc("record_debt_payment", {
    p_debt_id: parsed.data.debtId,
    p_wallet_id: parsed.data.walletId,
    p_pocket_id: parsed.data.pocketId,
    p_principal: normalizeAmount(parsed.data.principal),
    p_interest: normalizeAmount(parsed.data.interest),
    p_interest_category_id: parsed.data.categoryId,
  });

  if (error) {
    logDatabaseErrorInDev("recordDebtPayment failed", error);
    return { error: "บันทึกการชำระไม่สำเร็จ" };
  }
  redirect(`/finance/debts/${parsed.data.debtId}`);
}

export async function recordAdditionalDebtPrincipalAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const parsed = z
    .object({
      debtId: uuid,
      walletId: uuid,
      pocketId: uuid,
      principal: positiveAmountSchema,
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: "ข้อมูลไม่ถูกต้อง" };

  const { error } = await supabase.rpc("record_additional_debt_principal", {
    p_debt_id: parsed.data.debtId,
    p_wallet_id: parsed.data.walletId,
    p_pocket_id: parsed.data.pocketId,
    p_principal: normalizeAmount(parsed.data.principal),
  });

  if (error) {
    logDatabaseErrorInDev("recordAdditionalDebtPrincipal failed", error);
    return { error: "บันทึกเงินต้นเพิ่มไม่สำเร็จ" };
  }
  redirect(`/finance/debts/${parsed.data.debtId}`);
}

export async function setDebtArchivedAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const parsed = z
    .object({ debtId: uuid, archived: z.enum(["true", "false"]) })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: "ข้อมูลไม่ถูกต้อง" };

  const { error } = await supabase
    .from("debt_accounts")
    .update({
      archived_at:
        parsed.data.archived === "true" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.debtId);

  if (error) {
    logDatabaseErrorInDev("setDebtArchived failed", error);
    return { error: "เปลี่ยนสถานะหนี้ไม่สำเร็จ กรุณาลองใหม่" };
  }
  redirect(`/finance/debts/${parsed.data.debtId}`);
}
