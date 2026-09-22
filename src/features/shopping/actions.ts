"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";
import { normalizeAmount, positiveAmountSchema } from "@/lib/validation/money";
import {
  createShoppingItem,
  setShoppingItemArchived,
  setShoppingItemPurchased,
} from "./api";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const shoppingItemSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().trim().min(1, "กรุณาระบุของที่ต้องซื้อ").max(120),
  note: optionalText(500),
  store: optionalText(120),
  quantity: z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,3})?$/, "จำนวนไม่ถูกต้อง")
    .refine((value) => Number(value) > 0, "จำนวนต้องมากกว่า 0"),
  unit: optionalText(40),
  estimatedAmount: z
    .union([z.literal(""), positiveAmountSchema])
    .transform((value) => (value ? normalizeAmount(value) : null)),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  assignedMemberId: z
    .union([z.literal(""), z.string().uuid()])
    .transform((value) => value || null),
});

function stringValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function parseShoppingItemForm(form: FormData) {
  return shoppingItemSchema.safeParse({
    householdId: stringValue(form, "householdId"),
    name: stringValue(form, "name"),
    note: stringValue(form, "note"),
    store: stringValue(form, "store"),
    quantity: stringValue(form, "quantity") || "1",
    unit: stringValue(form, "unit"),
    estimatedAmount: stringValue(form, "estimatedAmount"),
    currency: stringValue(form, "currency") || "THB",
    assignedMemberId: stringValue(form, "assignedMemberId"),
  });
}

export async function createShoppingItemAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = parseShoppingItemForm(form);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  try {
    const { supabase } = await requireUser();
    await createShoppingItem(supabase, parsed.data);
    revalidatePath("/shopping");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    logDatabaseErrorInDev("createShoppingItemAction failed", error);
    return { error: "เพิ่มรายการไม่สำเร็จ" };
  }
}

export async function updateShoppingItemAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const itemId = stringValue(form, "itemId");
  const parsed = parseShoppingItemForm(form);
  if (!z.string().uuid().safeParse(itemId).success || !parsed.success)
    return {
      error: parsed.success
        ? "ไม่พบรายการที่ต้องการแก้ไข"
        : (parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"),
    };
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("update_shopping_item", {
      p_item_id: itemId,
      p_name: parsed.data.name,
      p_note: parsed.data.note,
      p_store: parsed.data.store,
      p_quantity: parsed.data.quantity,
      p_unit: parsed.data.unit,
      p_estimated_amount: parsed.data.estimatedAmount,
      p_currency: parsed.data.currency,
      p_assigned_member_id: parsed.data.assignedMemberId,
    });
    if (error) throw error;
    revalidatePath("/shopping");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    logDatabaseErrorInDev("updateShoppingItemAction failed", error);
    return { error: "แก้ไขรายการไม่สำเร็จ" };
  }
}

export async function toggleShoppingItemAction(form: FormData) {
  const itemId = stringValue(form, "itemId");
  const purchased = stringValue(form, "purchased") === "true";
  if (!z.string().uuid().safeParse(itemId).success) return;
  try {
    const { supabase } = await requireUser();
    await setShoppingItemPurchased(supabase, itemId, purchased);
    revalidatePath("/shopping");
    revalidatePath("/");
  } catch (error) {
    logDatabaseErrorInDev("toggleShoppingItemAction failed", error);
  }
}

export async function archiveShoppingItemAction(form: FormData) {
  const itemId = stringValue(form, "itemId");
  if (!z.string().uuid().safeParse(itemId).success) return;
  try {
    const { supabase } = await requireUser();
    await setShoppingItemArchived(supabase, itemId);
    revalidatePath("/shopping");
    revalidatePath("/");
  } catch (error) {
    logDatabaseErrorInDev("archiveShoppingItemAction failed", error);
  }
}

const shoppingExpenseSchema = z.object({
  shoppingItemId: z.string().uuid(),
  walletId: z.string().uuid(),
  pocketId: z.string().uuid(),
  categoryId: z.string().uuid("กรุณาเลือกหมวดหมู่"),
  amount: positiveAmountSchema,
  title: optionalText(200),
  note: optionalText(2000),
  occurredAt: z
    .string()
    .min(1)
    .refine(
      (value) => !Number.isNaN(new Date(`${value}T12:00:00`).getTime()),
      "วันที่ไม่ถูกต้อง",
    )
    .transform((value) => new Date(`${value}T12:00:00`).toISOString()),
  tagIds: z.array(z.string().uuid()).max(20),
});

export async function createShoppingExpenseAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = shoppingExpenseSchema.safeParse({
    shoppingItemId: stringValue(form, "shoppingItemId"),
    walletId: stringValue(form, "walletId"),
    pocketId: stringValue(form, "pocketId"),
    categoryId: stringValue(form, "categoryId"),
    amount: stringValue(form, "amount"),
    title: stringValue(form, "title"),
    note: stringValue(form, "note"),
    occurredAt: stringValue(form, "occurredAt"),
    tagIds: form
      .getAll("tagIds")
      .filter((value): value is string => typeof value === "string"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("create_shopping_item_expense", {
      p_item_id: parsed.data.shoppingItemId,
      p_wallet_id: parsed.data.walletId,
      p_pocket_id: parsed.data.pocketId,
      p_category_id: parsed.data.categoryId,
      p_amount: normalizeAmount(parsed.data.amount),
      p_title: parsed.data.title,
      p_note: parsed.data.note,
      p_occurred_at: parsed.data.occurredAt,
      p_tag_ids: parsed.data.tagIds.length ? parsed.data.tagIds : null,
    });
    if (error) throw error;
  } catch (error) {
    logDatabaseErrorInDev("createShoppingExpenseAction failed", error);
    return { error: "สร้างรายจ่ายไม่สำเร็จ" };
  }
  revalidatePath("/shopping");
  revalidatePath("/finance");
  redirect("/shopping");
}
