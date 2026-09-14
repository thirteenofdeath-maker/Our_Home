"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getMyPrimaryHousehold } from "@/features/household/api";
import { FINANCE_RETURN_TO } from "@/features/finance/domain/finance";
import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";
import {
  nonnegativeAmountSchema,
  normalizeNonnegativeAmount,
  positiveAmountSchema,
} from "@/lib/validation/money";
import { compareMoney } from "@/lib/utils/money";

import {
  archiveWallet,
  createCreditCardWallet,
  createWalletWithInitialBalance,
  deleteWallet,
  restoreWallet,
  updateWallet,
} from "./api";

const walletTypeSchema = z.enum([
  "BANK",
  "CASH",
  "CREDIT_CARD",
  "E_WALLET",
  "OTHER",
]);

const createWalletSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Wallet name is required")
    .max(80, "Keep it under 80 characters"),
  walletType: walletTypeSchema,
  currency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code, e.g. THB")
    .transform((v) => v.toUpperCase()),
  scope: z.enum(["PERSONAL", "HOUSEHOLD"]),
});

export async function createWalletAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const parsed = createWalletSchema.safeParse({
    name: formData.get("name"),
    walletType: formData.get("walletType"),
    currency: formData.get("currency") || "THB",
    scope: formData.get("scope"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let householdId: string | null = null;
  if (parsed.data.scope === "HOUSEHOLD") {
    const household = await getMyPrimaryHousehold(supabase, user.id);
    if (!household) {
      return {
        error: "Create a household first before adding a household wallet",
      };
    }
    householdId = household.id;
  }

  let walletId: string;
  try {
    if (parsed.data.walletType === "CREDIT_CARD") {
      const card = z
        .object({
          creditLimit: positiveAmountSchema,
          availableCredit: nonnegativeAmountSchema,
          statementClosingDay: z.coerce.number().int().min(1).max(31),
          paymentDueDay: z.coerce.number().int().min(1).max(31),
        })
        .safeParse({
          creditLimit: formData.get("creditLimit"),
          availableCredit: formData.get("availableCredit"),
          statementClosingDay: formData.get("statementClosingDay"),
          paymentDueDay: formData.get("paymentDueDay"),
        });
      if (!card.success) {
        return { error: "กรอกวงเงินและวันที่ของบัตรเครดิตให้ถูกต้อง" };
      }
      const creditLimit = normalizeNonnegativeAmount(card.data.creditLimit);
      const availableCredit = normalizeNonnegativeAmount(
        card.data.availableCredit,
      );
      if (compareMoney(availableCredit, creditLimit) > 0) {
        return { error: "วงเงินคงเหลือต้องไม่เกินวงเงินทั้งหมด" };
      }
      walletId = await createCreditCardWallet(supabase, {
        name: parsed.data.name,
        currency: parsed.data.currency,
        scope: parsed.data.scope,
        householdId,
        creditLimit,
        availableCredit,
        statementClosingDay: card.data.statementClosingDay,
        paymentDueDay: card.data.paymentDueDay,
      });
    } else {
      const regular = z
        .object({
          firstPocketName: z
            .string()
            .trim()
            .min(1, "กรุณาระบุชื่อช่องแรก")
            .max(60),
          initialBalance: nonnegativeAmountSchema,
        })
        .safeParse({
          firstPocketName: formData.get("firstPocketName"),
          initialBalance: formData.get("initialBalance") || "0",
        });
      if (!regular.success) {
        return {
          error: regular.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
        };
      }
      walletId = await createWalletWithInitialBalance(supabase, {
        name: parsed.data.name,
        walletType: parsed.data.walletType,
        currency: parsed.data.currency,
        scope: parsed.data.scope,
        ownerUserId: parsed.data.scope === "PERSONAL" ? user.id : null,
        householdId,
        firstPocketName: regular.data.firstPocketName,
        initialBalance: normalizeNonnegativeAmount(regular.data.initialBalance),
      });
    }
  } catch (err) {
    logDatabaseErrorInDev("createWallet failed", err);
    return {
      error:
        parsed.data.walletType === "CREDIT_CARD"
          ? "สร้างบัตรเครดิตไม่สำเร็จ กรุณาตรวจสอบวงเงินและข้อมูลบัตร"
          : "สร้างกระเป๋าเงินไม่สำเร็จ",
    };
  }

  redirect(`/wallets/${walletId}`);
}

const updateWalletSchema = z.object({
  walletId: z.string().uuid(),
  name: z
    .string()
    .trim()
    .min(1, "Wallet name is required")
    .max(80, "Keep it under 80 characters"),
  walletType: walletTypeSchema,
  currency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code, e.g. THB")
    .transform((v) => v.toUpperCase()),
});

export async function updateWalletAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = updateWalletSchema.safeParse({
    walletId: formData.get("walletId"),
    name: formData.get("name"),
    walletType: formData.get("walletType"),
    currency: formData.get("currency"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updateWallet(supabase, parsed.data.walletId, {
      name: parsed.data.name,
      walletType: parsed.data.walletType,
      currency: parsed.data.currency,
    });
  } catch (err) {
    logDatabaseErrorInDev("updateWallet failed", err);
    // The DB layer is the source of truth for "can currency change" (it
    // depends on ledger history, which this action does not check itself)
    // — surface its rejection rather than guessing at a generic message.
    return {
      error:
        "Could not update wallet — it may already have transaction history that keeps its currency fixed",
    };
  }

  revalidatePath(`/wallets/${parsed.data.walletId}`);
  return {};
}

const walletIdSchema = z.string().uuid();

// useActionState-shaped (not a plain void form action): archiving can
// genuinely fail for a business reason (non-zero balance) that the user
// must actually see, not have silently swallowed.
export async function archiveWalletAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const walletId = walletIdSchema.parse(formData.get("walletId"));

  try {
    await archiveWallet(supabase, walletId);
  } catch (err) {
    logDatabaseErrorInDev("archiveWallet failed", err);
    return { error: "ไม่สามารถเก็บถาวรได้ — ยอดคงเหลือต้องเป็นศูนย์ก่อน" };
  }

  revalidatePath(`/wallets/${walletId}`);
  revalidatePath("/wallets");
  revalidatePath(FINANCE_RETURN_TO);
  return {};
}

export async function restoreWalletAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const walletId = walletIdSchema.parse(formData.get("walletId"));
  await restoreWallet(supabase, walletId);
  revalidatePath(`/wallets/${walletId}`);
  revalidatePath("/wallets");
  revalidatePath(FINANCE_RETURN_TO);
}

export async function deleteWalletAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const walletId = walletIdSchema.parse(formData.get("walletId"));

  try {
    await deleteWallet(supabase, walletId);
  } catch (err) {
    logDatabaseErrorInDev("deleteWallet failed", err);
    return {
      error:
        "ไม่สามารถลบได้ — กระเป๋าเงินนี้มีประวัติธุรกรรมแล้ว ให้เก็บถาวรแทน",
    };
  }

  revalidatePath("/wallets");
  revalidatePath(FINANCE_RETURN_TO);
  redirect("/wallets");
}
