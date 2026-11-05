"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";
import { normalizeAmount } from "@/lib/validation/money";
import { expenseInput } from "./domain";

export async function saveHouseholdExpenseAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = expenseInput.safeParse({
    id: form.get("id"),
    householdId: form.get("householdId"),
    title: form.get("title"),
    category: form.get("category"),
    amount: form.get("amount"),
    paidOn: form.get("paidOn"),
    payerId: form.get("payerId"),
    itemIds: [...new Set(form.getAll("itemId"))],
    edit: form.get("edit") === "true",
  });
  if (!parsed.success)
    return { error: "ตรวจสอบชื่อรายการ ยอดจ่าย วันที่ และคนจ่าย" };

  const { supabase } = await requireUser();
  const input = parsed.data;
  const { error } = await supabase.rpc("save_household_expense", {
    p_id: input.id,
    p_household_id: input.householdId,
    p_title: input.title,
    p_category: input.category,
    p_amount: normalizeAmount(input.amount),
    p_paid_on: input.paidOn,
    p_payer_id: input.payerId,
    p_item_ids: input.itemIds,
    p_edit: input.edit,
  });
  if (error) {
    logDatabaseErrorInDev("saveHouseholdExpenseAction failed", error);
    return {
      error:
        error.code === "23505"
          ? "รายการซื้อนี้มีค่าใช้จ่ายแล้ว กรุณาเปิดรายการจากหน้าซื้อของ"
          : "บันทึกค่าใช้จ่ายไม่สำเร็จ กรุณาลองอีกครั้ง",
    };
  }

  revalidatePath("/");
  revalidatePath("/calendar/expenses");
  revalidatePath("/calendar");
  revalidatePath("/shopping");
  if (input.itemIds.length || input.edit) {
    redirect(`/calendar/expenses?month=${input.paidOn.slice(0, 7)}`);
  }
  return { success: true };
}

export async function markReceiptPurchasedAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const items = z
    .array(z.uuid())
    .min(1)
    .max(100)
    .safeParse(form.getAll("itemId"));
  if (!items.success)
    return { error: "เลือกรายการที่ต้องการทำเครื่องหมายว่าซื้อแล้ว" };

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("mark_shopping_receipt_purchased", {
    p_item_ids: items.data,
  });
  if (error) {
    logDatabaseErrorInDev("markReceiptPurchasedAction failed", error);
    return { error: "บันทึกสถานะซื้อแล้วไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/shopping");
  redirect("/calendar?view=shopping");
}
