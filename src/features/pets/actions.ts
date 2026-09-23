"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";

import {
  archivePetCareRecord,
  createPet,
  createPetCareRecord,
  deletePetDocument,
  deletePetPhoto,
  getPet,
  setPetArchived,
  updatePet,
  updatePetCareRecord,
  uploadPetDocument,
  uploadPetPhoto,
} from "./api";
import {
  PET_DOCUMENT_MIME_EXTENSIONS,
  petCareRecordSchema,
  petDocumentPath,
  validatePetDocument,
} from "./domain/care-record";
import {
  petFormSchema,
  PET_PHOTO_MIME_EXTENSIONS,
  petPhotoPath,
  validatePetPhoto,
} from "./domain/pet";

function parse(formData: FormData) {
  return petFormSchema.safeParse({
    name: formData.get("name"),
    species: formData.get("species"),
    breed: formData.get("breed"),
    sex: formData.get("sex"),
    birthday: formData.get("birthday"),
    caregiverIds: formData.getAll("caregiverIds"),
  });
}
function photo(formData: FormData) {
  const value = formData.get("photo");
  return value instanceof File && value.size > 0 ? value : null;
}

export async function createPetAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const values = parse(formData);
  if (!values.success)
    return { error: values.error.issues[0]?.message ?? "Invalid input" };
  const household = await getMyPrimaryHousehold(supabase, user.id);
  if (!household) return { error: "Household not found" };
  const file = photo(formData);
  if (file) {
    const error = validatePetPhoto(file);
    if (error) return { error };
  }
  const id = randomUUID();
  const path = file
    ? petPhotoPath(
        household.id,
        id,
        file.type as keyof typeof PET_PHOTO_MIME_EXTENSIONS,
      )
    : null;
  try {
    if (file && path) await uploadPetPhoto(supabase, path, file);
    await createPet(supabase, {
      id,
      householdId: household.id,
      ...values.data,
      photoPath: path,
    });
  } catch (error) {
    logDatabaseErrorInDev("createPetAction failed", error);
    if (path) await deletePetPhoto(supabase, path);
    return { error: "Could not create pet" };
  }
  revalidatePath("/pets");
  redirect(`/pets?pet=${id}`);
}

export async function updatePetAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const petId = formData.get("petId");
  if (typeof petId !== "string") return { error: "Invalid pet" };
  const values = parse(formData);
  if (!values.success)
    return { error: values.error.issues[0]?.message ?? "Invalid input" };
  const current = await getPet(supabase, petId);
  if (!current) return { error: "Pet not found" };
  const file = photo(formData);
  if (file) {
    const error = validatePetPhoto(file);
    if (error) return { error };
  }
  const path = file
    ? petPhotoPath(
        current.household_id,
        petId,
        file.type as keyof typeof PET_PHOTO_MIME_EXTENSIONS,
      )
    : current.photo_path;
  try {
    if (file) await uploadPetPhoto(supabase, path!, file);
    await updatePet(supabase, petId, { ...values.data, photoPath: path });
    if (file && current.photo_path && current.photo_path !== path)
      await deletePetPhoto(supabase, current.photo_path);
  } catch (error) {
    logDatabaseErrorInDev("updatePetAction failed", error);
    return { error: "Could not update pet" };
  }
  revalidatePath("/pets");
  revalidatePath(`/pets/${petId}`);
  redirect(`/pets?pet=${petId}`);
}

export async function archivePetAction(formData: FormData) {
  const { supabase } = await requireUser();
  const petId = formData.get("petId");
  const archived = formData.get("archived") === "true";
  if (typeof petId !== "string") return;
  try {
    await setPetArchived(supabase, petId, archived);
  } catch (error) {
    logDatabaseErrorInDev("archivePetAction failed", error);
    return;
  }
  revalidatePath("/pets");
  revalidatePath(`/pets/${petId}`);
  redirect(`/pets/${petId}`);
}

function careDocument(formData: FormData) {
  const value = formData.get("document");
  return value instanceof File && value.size > 0 ? value : null;
}

function parsePetCareRecord(formData: FormData) {
  return petCareRecordSchema.safeParse({
    petId: formData.get("petId"),
    recordType: formData.get("recordType"),
    title: formData.get("title"),
    note: formData.get("note"),
    recordedAt: formData.get("recordedAt"),
    scheduledAt: formData.get("scheduledAt"),
    nextIntervalDays: formData.get("nextIntervalDays") ?? "",
    value: formData.get("value") ?? "",
    unit: formData.get("unit") ?? "",
    provider: formData.get("provider") ?? "",
    transactionId: formData.get("transactionId") ?? "",
  });
}

export async function createPetCareRecordAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const parsed = parsePetCareRecord(formData);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const pet = await getPet(supabase, parsed.data.petId);
  if (!pet) return { error: "ไม่พบสัตว์เลี้ยง" };
  const file = careDocument(formData);
  if (file) {
    const error = validatePetDocument(file);
    if (error) return { error };
  }
  const recordId = randomUUID();
  const documentPath = file
    ? petDocumentPath(
        pet.household_id,
        pet.id,
        recordId,
        file.type as keyof typeof PET_DOCUMENT_MIME_EXTENSIONS,
      )
    : null;
  try {
    if (file && documentPath)
      await uploadPetDocument(supabase, documentPath, file);
    await createPetCareRecord(supabase, {
      id: recordId,
      pet_id: pet.id,
      household_id: pet.household_id,
      created_by: user.id,
      record_type: parsed.data.recordType,
      title: parsed.data.title,
      note: parsed.data.note,
      recorded_at: parsed.data.recordedAt,
      scheduled_at: parsed.data.scheduledAt,
      value: parsed.data.value,
      unit: parsed.data.unit,
      provider: parsed.data.provider,
      transaction_id: parsed.data.transactionId,
      document_path: documentPath,
    });
  } catch (error) {
    logDatabaseErrorInDev("createPetCareRecordAction failed", error);
    if (documentPath) await deletePetDocument(supabase, documentPath);
    return { error: "เพิ่มบันทึกไม่สำเร็จ" };
  }
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath(`/pets/${pet.id}`);
  return { success: true };
}

export async function updatePetCareRecordAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const recordId = formData.get("recordId");
  if (typeof recordId !== "string") return { error: "ไม่พบบันทึก" };
  const parsed = parsePetCareRecord(formData);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  try {
    const { supabase } = await requireUser();
    await updatePetCareRecord(supabase, recordId, {
      recordType: parsed.data.recordType,
      title: parsed.data.title,
      note: parsed.data.note,
      recordedAt: parsed.data.recordedAt,
      scheduledAt: parsed.data.scheduledAt,
      value: parsed.data.value,
      unit: parsed.data.unit,
      provider: parsed.data.provider,
      transactionId: parsed.data.transactionId,
    });
  } catch (error) {
    logDatabaseErrorInDev("updatePetCareRecordAction failed", error);
    return { error: "แก้ไขบันทึกไม่สำเร็จ" };
  }
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath(`/pets/${parsed.data.petId}`);
  return { success: true };
}

export async function archivePetCareRecordAction(formData: FormData) {
  const { supabase } = await requireUser();
  const recordId = formData.get("recordId");
  const petId = formData.get("petId");
  if (typeof recordId !== "string" || typeof petId !== "string") return;
  try {
    await archivePetCareRecord(supabase, recordId);
  } catch (error) {
    logDatabaseErrorInDev("archivePetCareRecordAction failed", error);
    return;
  }
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath(`/pets/${petId}`);
}
