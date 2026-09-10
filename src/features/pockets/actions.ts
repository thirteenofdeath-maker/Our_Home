"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { FINANCE_RETURN_TO } from "@/features/finance/domain/finance";
import { requireUser } from "@/lib/auth/require-user";
import type { ActionState } from "@/lib/types/action-state";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";

import { archivePocket, createPocket, deletePocket, restorePocket, updatePocket } from "./api";

const createPocketSchema = z.object({
  walletId: z.string().uuid(),
  name: z.string().trim().min(1, "Pocket name is required").max(60, "Keep it under 60 characters"),
});

export async function createPocketAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = createPocketSchema.safeParse({
    walletId: formData.get("walletId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createPocket(supabase, { walletId: parsed.data.walletId, name: parsed.data.name });
  } catch (err) {
    logDatabaseErrorInDev("createPocketAction failed", err);
    return { error: "Could not create pocket" };
  }

  revalidatePath(`/wallets/${parsed.data.walletId}`);
  redirect(`/wallets/${parsed.data.walletId}`);
}

const renamePocketSchema = z.object({
  pocketId: z.string().uuid(),
  walletId: z.string().uuid(),
  name: z.string().trim().min(1, "Pocket name is required").max(60, "Keep it under 60 characters"),
});

export async function renamePocketAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = renamePocketSchema.safeParse({
    pocketId: formData.get("pocketId"),
    walletId: formData.get("walletId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updatePocket(supabase, parsed.data.pocketId, parsed.data.walletId, { name: parsed.data.name });
  } catch (err) {
    logDatabaseErrorInDev("renamePocket failed", err);
    return { error: "เปลี่ยนชื่อ Pocket ไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }

  revalidatePath(`/wallets/${parsed.data.walletId}`);
  redirect(`/wallets/${parsed.data.walletId}`);
}

const pocketMutationSchema = z.object({
  pocketId: z.string().uuid(),
  walletId: z.string().uuid(),
});

// useActionState-shaped: archiving can fail ("must keep at least one
// active pocket") for a business reason the user must see.
export async function archivePocketAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const parsed = pocketMutationSchema.parse({ pocketId: formData.get("pocketId"), walletId: formData.get("walletId") });

  try {
    await archivePocket(supabase, parsed.pocketId);
  } catch (err) {
    logDatabaseErrorInDev("archivePocket failed", err);
    return { error: "ไม่สามารถเก็บถาวรได้ — ต้องมีอย่างน้อยหนึ่ง Pocket ที่ใช้งานอยู่เสมอ" };
  }

  revalidatePath(`/wallets/${parsed.walletId}`);
  revalidatePath(FINANCE_RETURN_TO);
  return {};
}

export async function restorePocketAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const parsed = pocketMutationSchema.parse({ pocketId: formData.get("pocketId"), walletId: formData.get("walletId") });
  await restorePocket(supabase, parsed.pocketId);
  revalidatePath(`/wallets/${parsed.walletId}`);
  revalidatePath(FINANCE_RETURN_TO);
}

// useActionState-shaped: deletion can fail ("has history" / "last
// pocket") for a business reason the user must see.
export async function deletePocketAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const parsed = pocketMutationSchema.parse({ pocketId: formData.get("pocketId"), walletId: formData.get("walletId") });

  try {
    await deletePocket(supabase, parsed.pocketId);
  } catch (err) {
    logDatabaseErrorInDev("deletePocket failed", err);
    return { error: "ไม่สามารถลบได้ — Pocket นี้มีประวัติธุรกรรม หรือเป็น Pocket สุดท้ายของกระเป๋าเงินนี้" };
  }

  revalidatePath(`/wallets/${parsed.walletId}`);
  revalidatePath(FINANCE_RETURN_TO);
  return {};
}
