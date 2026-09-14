"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getMyPrimaryHousehold } from "@/features/household/api";
import { archiveWallet, restoreWallet } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";
import { normalizeAmount, positiveAmountSchema } from "@/lib/validation/money";

import { createAttributedCardPurchase, createCardPurchase, createCardPurchaseRefund, createCreditCard, createCreditCardIssuerCharge, createCreditCardPayment, getCreditCard, updateCreditCard } from "./api";

const optionalText = z
  .string()
  .trim()
  .max(80)
  .transform((v) => v || null);
const cardFields = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อบัตร").max(80),
  issuer: optionalText,
  network: optionalText,
  lastFour: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^\d{4}$/.test(v),
      "เลขท้ายบัตรต้องเป็นตัวเลข 4 หลัก",
    )
    .transform((v) => v || null),
  creditLimit: z.coerce.number().positive("วงเงินต้องมากกว่า 0"),
  statementClosingDay: z.coerce.number().int().min(1).max(31),
  paymentDueDay: z.coerce.number().int().min(1).max(31),
  apr: z
    .union([z.literal(""), z.coerce.number().nonnegative()])
    .transform((v) => (v === "" ? null : String(v))),
});

const optionalLongText = z.string().trim().max(200).nullish().transform((value) => value || null);
const occurredAt = z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "กรุณาเลือกวันที่").transform((value) => new Date(`${value}T12:00:00`).toISOString());
const purchaseFields = z.object({
  cardAccountId: z.string().uuid(),
  expenseScope: z.enum(["PERSONAL", "HOUSEHOLD"]),
  categoryId: z.string().uuid("กรุณาเลือกหมวดหมู่"),
  amount: positiveAmountSchema,
  title: optionalLongText,
  note: optionalLongText,
  occurredAt,
  tagIds: z.array(z.string().uuid()).max(20),
});

export async function createCreditCardAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const parsed = cardFields
    .extend({
      scope: z.enum(["PERSONAL", "HOUSEHOLD"]),
      currency: z
        .string()
        .trim()
        .regex(/^[A-Za-z]{3}$/)
        .transform((v) => v.toUpperCase()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลบัตรไม่ถูกต้อง" };
  let householdId: string | null = null;
  if (parsed.data.scope === "HOUSEHOLD") {
    householdId = (await getMyPrimaryHousehold(supabase, user.id))?.id ?? null;
    if (!householdId)
      return { error: "กรุณาสร้างครอบครัวก่อนเพิ่มบัตรครอบครัว" };
  }
  let id: string;
  try {
    id = await createCreditCard(supabase, {
      ...parsed.data,
      householdId,
      creditLimit: String(parsed.data.creditLimit),
    });
  } catch (error) {
    logDatabaseErrorInDev("createCreditCardAction failed", error);
    return { error: "สร้างบัตรเครดิตไม่สำเร็จ" };
  }
  redirect(`/finance/cards/${id}`);
}

export async function updateCreditCardAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const parsed = cardFields
    .extend({ accountId: z.string().uuid() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลบัตรไม่ถูกต้อง" };
  try {
    await updateCreditCard(supabase, parsed.data.accountId, {
      ...parsed.data,
      creditLimit: String(parsed.data.creditLimit),
    });
  } catch (error) {
    logDatabaseErrorInDev("updateCreditCardAction failed", error);
    return { error: "แก้ไขข้อมูลบัตรไม่สำเร็จ" };
  }
  revalidatePath(`/finance/cards/${parsed.data.accountId}`);
  redirect(`/finance/cards/${parsed.data.accountId}`);
}

export async function archiveCreditCardAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const accountId = z.string().uuid().parse(formData.get("accountId"));
  const card = await getCreditCard(supabase, accountId);
  if (!card) return { error: "ไม่พบบัตรเครดิต" };
  try {
    await archiveWallet(supabase, card.walletId);
  } catch (error) {
    logDatabaseErrorInDev("archiveCreditCardAction failed", error);
    return { error: "เก็บถาวรไม่ได้ — ยอดบัตรต้องเป็นศูนย์ก่อน" };
  }
  revalidatePath("/finance/cards");
  revalidatePath(`/finance/cards/${accountId}`);
  return {};
}

export async function restoreCreditCardAction(
  formData: FormData,
): Promise<void> {
  const { supabase } = await requireUser();
  const accountId = z.string().uuid().parse(formData.get("accountId"));
  const card = await getCreditCard(supabase, accountId);
  if (!card) return;
  await restoreWallet(supabase, card.walletId);
  revalidatePath("/finance/cards");
  revalidatePath(`/finance/cards/${accountId}`);
}

export async function createCardPurchaseAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const parsed = purchaseFields.safeParse({
    cardAccountId: formData.get("cardAccountId"),
    expenseScope: formData.get("expenseScope"),
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    title: formData.get("title"),
    note: formData.get("note"),
    occurredAt: formData.get("occurredAt"),
    tagIds: formData.getAll("tagIds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลรายการไม่ถูกต้อง" };

  const card = await getCreditCard(supabase, parsed.data.cardAccountId);
  if (!card || card.isArchived) return { error: "ไม่พบบัตรเครดิตหรือบัตรถูกเก็บถาวรแล้ว" };
  if (card.scope === "HOUSEHOLD" && parsed.data.expenseScope !== "HOUSEHOLD") {
    return { error: "บัตรครอบครัวบันทึกได้เฉพาะรายจ่ายครอบครัว" };
  }

  let transactionId: string;
  try {
    if (card.scope === "PERSONAL" && parsed.data.expenseScope === "HOUSEHOLD") {
      const household = await getMyPrimaryHousehold(supabase, user.id);
      if (!household) return { error: "กรุณาสร้างครอบครัวก่อนบันทึกรายจ่ายครอบครัว" };
      transactionId = await createAttributedCardPurchase(supabase, {
        cardAccountId: card.accountId,
        householdId: household.id,
        householdCategoryId: parsed.data.categoryId,
        amount: normalizeAmount(parsed.data.amount),
        title: parsed.data.title,
        note: parsed.data.note,
        occurredAt: parsed.data.occurredAt,
      });
    } else {
      transactionId = await createCardPurchase(supabase, {
        cardAccountId: card.accountId,
        categoryId: parsed.data.categoryId,
        amount: normalizeAmount(parsed.data.amount),
        title: parsed.data.title,
        note: parsed.data.note,
        occurredAt: parsed.data.occurredAt,
        tagIds: parsed.data.tagIds,
      });
    }
  } catch (error) {
    logDatabaseErrorInDev("createCardPurchaseAction failed", error);
    return { error: "บันทึกรายการซื้อผ่านบัตรไม่สำเร็จ กรุณาตรวจหมวดหมู่และข้อมูลอีกครั้ง" };
  }
  revalidatePath(`/finance/cards/${card.accountId}`);
  revalidatePath("/finance/cards");
  revalidatePath("/finance");
  redirect(`/finance/transactions/${transactionId}`);
}

const refundFields = z.object({
  originalPurchaseTransactionId: z.string().uuid(),
  amount: positiveAmountSchema,
  title: optionalLongText,
  note: optionalLongText,
  occurredAt,
  tagIds: z.array(z.string().uuid()).max(20),
});

export async function createCardPurchaseRefundAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const parsed = refundFields.safeParse({
    originalPurchaseTransactionId: formData.get("originalPurchaseTransactionId"),
    amount: formData.get("amount"),
    title: formData.get("title"),
    note: formData.get("note"),
    occurredAt: formData.get("occurredAt"),
    tagIds: formData.getAll("tagIds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลคืนเงินไม่ถูกต้อง" };
  let transactionId: string;
  try {
    transactionId = await createCardPurchaseRefund(supabase, {
      originalPurchaseTransactionId: parsed.data.originalPurchaseTransactionId,
      amount: normalizeAmount(parsed.data.amount),
      title: parsed.data.title,
      note: parsed.data.note,
      occurredAt: parsed.data.occurredAt,
      tagIds: parsed.data.tagIds,
    });
  } catch (error) {
    logDatabaseErrorInDev("createCardPurchaseRefundAction failed", error);
    return { error: "คืนเงินไม่สำเร็จ — ตรวจสอบยอดที่ยังคืนได้และสถานะรายการ" };
  }
  revalidatePath(`/finance/transactions/${parsed.data.originalPurchaseTransactionId}`);
  revalidatePath("/finance/cards");
  revalidatePath("/finance");
  redirect(`/finance/transactions/${transactionId}`);
}

const paymentFields = z.object({
  cardAccountId: z.string().uuid(),
  fromWalletId: z.string().uuid("กรุณาเลือก Wallet ที่ใช้จ่าย"),
  fromPocketId: z.string().uuid("กรุณาเลือก Pocket ที่ใช้จ่าย"),
  amount: positiveAmountSchema,
  title: optionalLongText,
  note: optionalLongText,
  occurredAt,
});

export async function createCreditCardPaymentAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const parsed = paymentFields.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลการจ่ายบัตรไม่ถูกต้อง" };
  }

  const card = await getCreditCard(supabase, parsed.data.cardAccountId);
  if (!card || card.isArchived) {
    return { error: "ไม่พบบัตรเครดิตหรือบัตรถูกเก็บถาวรแล้ว" };
  }

  let transactionId: string;
  try {
    transactionId = await createCreditCardPayment(supabase, {
      cardAccountId: card.accountId,
      fromWalletId: parsed.data.fromWalletId,
      fromPocketId: parsed.data.fromPocketId,
      amount: normalizeAmount(parsed.data.amount),
      title: parsed.data.title,
      note: parsed.data.note,
      occurredAt: parsed.data.occurredAt,
    });
  } catch (error) {
    logDatabaseErrorInDev("createCreditCardPaymentAction failed", error);
    return { error: "จ่ายบัตรไม่สำเร็จ — ตรวจสอบยอดค้าง สกุลเงิน และ Wallet ที่ใช้จ่าย" };
  }

  revalidatePath(`/finance/cards/${card.accountId}`);
  revalidatePath("/finance/cards");
  revalidatePath("/finance");
  redirect(`/finance/transactions/${transactionId}`);
}

const issuerChargeFields = z.object({
  cardAccountId: z.string().uuid(),
  chargeKind: z.enum(["INTEREST", "FEE", "LATE_FEE"]),
  amount: positiveAmountSchema,
  title: optionalLongText,
  note: optionalLongText,
  occurredAt,
});

export async function createCreditCardIssuerChargeAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const parsed = issuerChargeFields.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลยอดเรียกเก็บไม่ถูกต้อง" };
  }
  const card = await getCreditCard(supabase, parsed.data.cardAccountId);
  if (!card || card.isArchived) {
    return { error: "ไม่พบบัตรเครดิตหรือบัตรถูกเก็บถาวรแล้ว" };
  }

  let transactionId: string;
  try {
    transactionId = await createCreditCardIssuerCharge(supabase, {
      cardAccountId: card.accountId,
      chargeKind: parsed.data.chargeKind,
      amount: normalizeAmount(parsed.data.amount),
      title: parsed.data.title,
      note: parsed.data.note,
      occurredAt: parsed.data.occurredAt,
    });
  } catch (error) {
    logDatabaseErrorInDev("createCreditCardIssuerChargeAction failed", error);
    return { error: "บันทึกยอดเรียกเก็บไม่สำเร็จ กรุณาตรวจข้อมูลอีกครั้ง" };
  }

  revalidatePath(`/finance/cards/${card.accountId}`);
  revalidatePath("/finance/cards");
  revalidatePath("/finance");
  redirect(`/finance/transactions/${transactionId}`);
}
