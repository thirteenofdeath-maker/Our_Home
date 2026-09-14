"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { FINANCE_RETURN_TO } from "@/features/finance/domain/finance";
import { requireUser } from "@/lib/auth/require-user";
import type { ActionState } from "@/lib/types/action-state";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import {
  nonnegativeAmountSchema,
  normalizeNonnegativeAmount,
  positiveAmountSchema,
} from "@/lib/validation/money";
import { compareMoney } from "@/lib/utils/money";

import {
  archivePocket,
  createCreditCardPocket,
  createPocketWithInitialBalance,
  deletePocket,
  restorePocket,
  updatePocket,
} from "./api";

const createPocketSchema = z.object({
  walletId: z.string().uuid(),
  name: z
    .string()
    .trim()
    .min(1, "Pocket name is required")
    .max(60, "Keep it under 60 characters"),
  pocketType: z.enum(["BANK", "CASH", "CREDIT_CARD", "E_WALLET", "OTHER"]),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/)
    .transform((value) => value.toUpperCase()),
});

export async function createPocketAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = createPocketSchema.safeParse({
    walletId: formData.get("walletId"),
    name: formData.get("name"),
    pocketType: formData.get("pocketType"),
    currency: formData.get("currency"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    if (parsed.data.pocketType === "CREDIT_CARD") {
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
      if (!card.success)
        return { error: "กรอกข้อมูลบัตรเครดิตให้ครบและถูกต้อง" };
      const creditLimit = normalizeNonnegativeAmount(card.data.creditLimit);
      const availableCredit = normalizeNonnegativeAmount(
        card.data.availableCredit,
      );
      if (compareMoney(availableCredit, creditLimit) > 0) {
        return { error: "วงเงินคงเหลือต้องไม่เกินวงเงินทั้งหมด" };
      }
      await createCreditCardPocket(supabase, {
        walletId: parsed.data.walletId,
        name: parsed.data.name,
        currency: parsed.data.currency,
        creditLimit,
        availableCredit,
        statementClosingDay: card.data.statementClosingDay,
        paymentDueDay: card.data.paymentDueDay,
      });
    } else {
      const initial = nonnegativeAmountSchema.safeParse(
        formData.get("initialBalance") || "0",
      );
      if (!initial.success) return { error: "ยอดเงินเริ่มต้นไม่ถูกต้อง" };
      await createPocketWithInitialBalance(supabase, {
        walletId: parsed.data.walletId,
        name: parsed.data.name,
        pocketType: parsed.data.pocketType,
        currency: parsed.data.currency,
        initialBalance: normalizeNonnegativeAmount(initial.data),
      });
    }
  } catch (err) {
    logDatabaseErrorInDev("createPocketAction failed", err);
    return {
      error:
        parsed.data.pocketType === "CREDIT_CARD"
          ? "สร้างบัตรเครดิตไม่สำเร็จ"
          : "สร้าง Pocket ไม่สำเร็จ",
    };
  }

  revalidatePath(`/wallets/${parsed.data.walletId}`);
  redirect(`/wallets/${parsed.data.walletId}`);
}

const updatePocketSchema = z.object({
  pocketId: z.string().uuid(),
  walletId: z.string().uuid(),
  name: z
    .string()
    .trim()
    .min(1, "Pocket name is required")
    .max(60, "Keep it under 60 characters"),
  pocketType: z.enum(["BANK", "CASH", "CREDIT_CARD", "E_WALLET", "OTHER"]),
  balance: z
    .string()
    .trim()
    .regex(/^-?\d{1,12}(\.\d{1,2})?$/, "ยอดเงินไม่ถูกต้อง"),
});

export async function renamePocketAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = updatePocketSchema.safeParse({
    pocketId: formData.get("pocketId"),
    walletId: formData.get("walletId"),
    name: formData.get("name"),
    pocketType: formData.get("pocketType"),
    balance: formData.get("balance"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updatePocket(supabase, parsed.data.pocketId, parsed.data.walletId, {
      name: parsed.data.name,
      pocketType: parsed.data.pocketType,
      targetBalance: normalizeSignedAmount(parsed.data.balance),
    });
  } catch (err) {
    logDatabaseErrorInDev("renamePocket failed", err);
    return {
      error:
        "แก้ไข Pocket ไม่สำเร็จ — ไม่สามารถเปลี่ยนระหว่างบัตรเครดิตกับ Pocket ทั่วไปได้",
    };
  }

  revalidatePath(`/wallets/${parsed.data.walletId}`);
  redirect(`/wallets/${parsed.data.walletId}`);
}

function normalizeSignedAmount(value: string): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  return `${negative ? "-" : ""}${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

const pocketMutationSchema = z.object({
  pocketId: z.string().uuid(),
  walletId: z.string().uuid(),
});

// useActionState-shaped: archiving can fail ("must keep at least one
// active pocket") for a business reason the user must see.
export async function archivePocketAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const parsed = pocketMutationSchema.parse({
    pocketId: formData.get("pocketId"),
    walletId: formData.get("walletId"),
  });

  try {
    await archivePocket(supabase, parsed.pocketId);
  } catch (err) {
    logDatabaseErrorInDev("archivePocket failed", err);
    return {
      error:
        "ไม่สามารถเก็บถาวรได้ — ต้องมีอย่างน้อยหนึ่ง Pocket ที่ใช้งานอยู่เสมอ",
    };
  }

  revalidatePath(`/wallets/${parsed.walletId}`);
  revalidatePath(FINANCE_RETURN_TO);
  return {};
}

export async function restorePocketAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const parsed = pocketMutationSchema.parse({
    pocketId: formData.get("pocketId"),
    walletId: formData.get("walletId"),
  });
  await restorePocket(supabase, parsed.pocketId);
  revalidatePath(`/wallets/${parsed.walletId}`);
  revalidatePath(FINANCE_RETURN_TO);
}

// useActionState-shaped: deletion can fail ("has history" / "last
// pocket") for a business reason the user must see.
export async function deletePocketAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const parsed = pocketMutationSchema.parse({
    pocketId: formData.get("pocketId"),
    walletId: formData.get("walletId"),
  });

  try {
    await deletePocket(supabase, parsed.pocketId);
  } catch (err) {
    logDatabaseErrorInDev("deletePocket failed", err);
    return {
      error:
        "ไม่สามารถลบได้ — Pocket นี้มีประวัติธุรกรรม หรือเป็น Pocket สุดท้ายของกระเป๋าเงินนี้",
    };
  }

  revalidatePath(`/wallets/${parsed.walletId}`);
  revalidatePath(FINANCE_RETURN_TO);
  return {};
}
