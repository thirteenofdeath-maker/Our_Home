"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);
const optionalDate = z
  .union([z.literal(""), z.iso.date()])
  .transform((value) => value || null);
const optionalNonNegative = z
  .union([
    z.literal(""),
    z
      .string()
      .regex(/^\d+(?:\.\d{1,3})?$/)
      .refine((value) => Number(value) >= 0),
  ])
  .transform((value) => value || null);
const optionalMoney = z
  .union([
    z.literal(""),
    z
      .string()
      .regex(/^\d+(?:\.\d{1,2})?$/)
      .refine((value) => Number(value) > 0),
  ])
  .transform((value) => value || null);

function value(form: FormData, key: string) {
  const item = form.get(key);
  return typeof item === "string" ? item : "";
}

const itemSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().trim().min(1, "กรุณาระบุชื่อของ").max(120),
  category: z.enum([
    "MEDICINE",
    "PET_SUPPLY",
    "HOUSEHOLD",
    "FOOD",
    "WARRANTY",
    "OTHER",
  ]),
  note: optionalText(1000),
  quantity: z
    .string()
    .regex(/^\d+(?:\.\d{1,3})?$/)
    .refine((item) => Number(item) >= 0, "จำนวนไม่ถูกต้อง"),
  unit: optionalText(40),
  restockThreshold: optionalNonNegative,
  expiryDate: optionalDate,
  warrantyExpiresOn: optionalDate,
  purchaseDate: optionalDate,
  location: optionalText(120),
  estimatedRestockAmount: optionalMoney,
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
});

function parseInventoryItemForm(form: FormData) {
  return itemSchema.safeParse({
    householdId: value(form, "householdId"),
    name: value(form, "name"),
    category: value(form, "category"),
    note: value(form, "note"),
    quantity: value(form, "quantity") || "1",
    unit: value(form, "unit"),
    restockThreshold: value(form, "restockThreshold"),
    expiryDate: value(form, "expiryDate"),
    warrantyExpiresOn: value(form, "warrantyExpiresOn"),
    purchaseDate: value(form, "purchaseDate"),
    location: value(form, "location"),
    estimatedRestockAmount: value(form, "estimatedRestockAmount"),
    currency: value(form, "currency") || "THB",
  });
}

export async function createInventoryItemAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = parseInventoryItemForm(form);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("create_inventory_item", {
      p_household_id: parsed.data.householdId,
      p_name: parsed.data.name,
      p_category: parsed.data.category,
      p_note: parsed.data.note,
      p_quantity: parsed.data.quantity,
      p_unit: parsed.data.unit,
      p_restock_threshold: parsed.data.restockThreshold,
      p_expiry_date: parsed.data.expiryDate,
      p_warranty_expires_on: parsed.data.warrantyExpiresOn,
      p_purchase_date: parsed.data.purchaseDate,
      p_location: parsed.data.location,
      p_estimated_restock_amount: parsed.data.estimatedRestockAmount,
      p_currency: parsed.data.currency,
    });
    if (error) throw error;
    revalidatePath("/inventory");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    logDatabaseErrorInDev("createInventoryItemAction failed", error);
    return { error: "เพิ่มของในคลังไม่สำเร็จ" };
  }
}

export async function updateInventoryItemAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const itemId = value(form, "itemId");
  const parsed = parseInventoryItemForm(form);
  if (!z.string().uuid().safeParse(itemId).success || !parsed.success)
    return {
      error: parsed.success
        ? "ไม่พบรายการที่ต้องการแก้ไข"
        : (parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง"),
    };
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("update_inventory_item", {
      p_item_id: itemId,
      p_name: parsed.data.name,
      p_category: parsed.data.category,
      p_note: parsed.data.note,
      p_quantity: parsed.data.quantity,
      p_unit: parsed.data.unit,
      p_restock_threshold: parsed.data.restockThreshold,
      p_expiry_date: parsed.data.expiryDate,
      p_warranty_expires_on: parsed.data.warrantyExpiresOn,
      p_purchase_date: parsed.data.purchaseDate,
      p_location: parsed.data.location,
      p_estimated_restock_amount: parsed.data.estimatedRestockAmount,
      p_currency: parsed.data.currency,
    });
    if (error) throw error;
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${itemId}`);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    logDatabaseErrorInDev("updateInventoryItemAction failed", error);
    return { error: "แก้ไขของในคลังไม่สำเร็จ" };
  }
}

export async function adjustInventoryQuantityAction(form: FormData) {
  const parsed = z
    .object({
      itemId: z.string().uuid(),
      delta: z.coerce
        .number()
        .min(-1)
        .max(1)
        .refine((delta) => delta !== 0),
    })
    .safeParse({
      itemId: value(form, "itemId"),
      delta: value(form, "delta"),
    });
  if (!parsed.success) return;
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("adjust_inventory_quantity", {
      p_item_id: parsed.data.itemId,
      p_delta: String(parsed.data.delta),
    });
    if (error) throw error;
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${parsed.data.itemId}`);
  } catch (error) {
    logDatabaseErrorInDev("adjustInventoryQuantityAction failed", error);
  }
}

export async function sendInventoryToShoppingAction(form: FormData) {
  const itemId = value(form, "itemId");
  if (!z.string().uuid().safeParse(itemId).success) return;
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("send_inventory_item_to_shopping", {
      p_item_id: itemId,
    });
    if (error) throw error;
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${itemId}`);
    revalidatePath("/shopping");
  } catch (error) {
    logDatabaseErrorInDev("sendInventoryToShoppingAction failed", error);
  }
}

export async function archiveInventoryItemAction(form: FormData) {
  const itemId = value(form, "itemId");
  if (!z.string().uuid().safeParse(itemId).success) return;
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("set_inventory_item_archived", {
      p_item_id: itemId,
      p_archived: true,
    });
    if (error) throw error;
    revalidatePath("/inventory");
    revalidatePath("/");
  } catch (error) {
    logDatabaseErrorInDev("archiveInventoryItemAction failed", error);
    return;
  }
  redirect("/inventory");
}

const documentType = z.enum(["RECEIPT", "MANUAL", "WARRANTY", "OTHER"]);
const allowedMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export async function uploadInventoryDocumentAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const file = form.get("file");
  const parsed = z
    .object({
      itemId: z.string().uuid(),
      householdId: z.string().uuid(),
      title: z.string().trim().min(1).max(160),
      type: documentType,
    })
    .safeParse({
      itemId: value(form, "itemId"),
      householdId: value(form, "householdId"),
      title: value(form, "title"),
      type: value(form, "documentType"),
    });
  if (!parsed.success || !(file instanceof File) || !file.size)
    return { error: "กรอกข้อมูลและเลือกไฟล์ก่อน" };
  const extension = allowedMime[file.type];
  if (!extension || file.size > 6 * 1024 * 1024)
    return { error: "รองรับ JPEG, PNG, WebP หรือ PDF ไม่เกิน 6 MB" };
  const id = crypto.randomUUID();
  const path = `${parsed.data.householdId}/${parsed.data.itemId}/${id}/document.${extension}`;
  try {
    const { supabase, user } = await requireUser();
    const uploaded = await supabase.storage
      .from("inventory-documents")
      .upload(path, file, { contentType: file.type });
    if (uploaded.error) throw uploaded.error;
    const { error } = await supabase.from("inventory_documents").insert({
      id,
      item_id: parsed.data.itemId,
      household_id: parsed.data.householdId,
      document_type: parsed.data.type,
      title: parsed.data.title,
      storage_path: path,
      mime_type: file.type,
      file_size: file.size,
      created_by: user.id,
    });
    if (error) {
      await supabase.storage.from("inventory-documents").remove([path]);
      throw error;
    }
    revalidatePath(`/inventory/${parsed.data.itemId}`);
    return { success: true };
  } catch (error) {
    logDatabaseErrorInDev("uploadInventoryDocumentAction failed", error);
    return { error: "อัปโหลดเอกสารไม่สำเร็จ" };
  }
}

export async function deleteInventoryDocumentAction(form: FormData) {
  const parsed = z
    .object({ id: z.string().uuid(), itemId: z.string().uuid() })
    .safeParse({ id: value(form, "id"), itemId: value(form, "itemId") });
  if (!parsed.success) return;
  try {
    const { supabase } = await requireUser();
    const { data } = await supabase
      .from("inventory_documents")
      .select("storage_path")
      .eq("id", parsed.data.id)
      .maybeSingle();
    const { error } = await supabase
      .from("inventory_documents")
      .delete()
      .eq("id", parsed.data.id);
    if (error) throw error;
    if (data?.storage_path)
      await supabase.storage
        .from("inventory-documents")
        .remove([data.storage_path]);
    revalidatePath(`/inventory/${parsed.data.itemId}`);
  } catch (error) {
    logDatabaseErrorInDev("deleteInventoryDocumentAction failed", error);
  }
}
