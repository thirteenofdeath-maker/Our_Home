"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getMyPrimaryHousehold } from "@/features/household/api";
import { archiveWallet, restoreWallet } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";

import { createCreditCard, getCreditCard, updateCreditCard } from "./api";

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
