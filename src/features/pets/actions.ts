"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";

import { createPet, deletePetPhoto, getPet, setPetArchived, updatePet, uploadPetPhoto } from "./api";
import { petFormSchema, PET_PHOTO_MIME_EXTENSIONS, petPhotoPath, validatePetPhoto } from "./domain/pet";

function parse(formData: FormData) {
  return petFormSchema.safeParse({
    name: formData.get("name"), species: formData.get("species"), breed: formData.get("breed"),
    sex: formData.get("sex"), birthday: formData.get("birthday"), caregiverIds: formData.getAll("caregiverIds"),
  });
}
function photo(formData: FormData) {
  const value = formData.get("photo");
  return value instanceof File && value.size > 0 ? value : null;
}

export async function createPetAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const values = parse(formData);
  if (!values.success) return { error: values.error.issues[0]?.message ?? "Invalid input" };
  const household = await getMyPrimaryHousehold(supabase, user.id);
  if (!household) return { error: "Household not found" };
  const file = photo(formData);
  if (file) { const error = validatePetPhoto(file); if (error) return { error }; }
  const id = randomUUID();
  const path = file ? petPhotoPath(household.id, id, file.type as keyof typeof PET_PHOTO_MIME_EXTENSIONS) : null;
  try {
    if (file && path) await uploadPetPhoto(supabase, path, file);
    await createPet(supabase, { id, householdId: household.id, ...values.data, photoPath: path });
  } catch (error) {
    logDatabaseErrorInDev("createPetAction failed", error);
    if (path) await deletePetPhoto(supabase, path);
    return { error: "Could not create pet" };
  }
  revalidatePath("/pets");
  redirect(`/pets/${id}`);
}

export async function updatePetAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const petId = formData.get("petId");
  if (typeof petId !== "string") return { error: "Invalid pet" };
  const values = parse(formData);
  if (!values.success) return { error: values.error.issues[0]?.message ?? "Invalid input" };
  const current = await getPet(supabase, petId);
  if (!current) return { error: "Pet not found" };
  const file = photo(formData);
  if (file) { const error = validatePetPhoto(file); if (error) return { error }; }
  const path = file ? petPhotoPath(current.household_id, petId, file.type as keyof typeof PET_PHOTO_MIME_EXTENSIONS) : current.photo_path;
  try {
    if (file) await uploadPetPhoto(supabase, path!, file);
    await updatePet(supabase, petId, { ...values.data, photoPath: path });
    if (file && current.photo_path && current.photo_path !== path) await deletePetPhoto(supabase, current.photo_path);
  } catch (error) {
    logDatabaseErrorInDev("updatePetAction failed", error);
    return { error: "Could not update pet" };
  }
  revalidatePath("/pets"); revalidatePath(`/pets/${petId}`);
  redirect(`/pets/${petId}`);
}

export async function archivePetAction(formData: FormData) {
  const { supabase } = await requireUser();
  const petId = formData.get("petId");
  const archived = formData.get("archived") === "true";
  if (typeof petId !== "string") return;
  try { await setPetArchived(supabase, petId, archived); }
  catch (error) { logDatabaseErrorInDev("archivePetAction failed", error); return; }
  revalidatePath("/pets"); revalidatePath(`/pets/${petId}`);
  redirect(`/pets/${petId}`);
}
