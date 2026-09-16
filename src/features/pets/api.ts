import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { listHouseholdMembers } from "@/features/household/api";
import type { Database, HouseholdRole, PetSex, PetSpecies } from "@/types/database";

import type { Pet, PetCareRecord, PetCareRecordWithDocument, PetWithCaregivers } from "./types";

async function signedPhotoUrl(supabase: SupabaseClient<Database>, path: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("pet-photos").createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}

async function hydratePets(supabase: SupabaseClient<Database>, householdId: string, pets: Pet[]): Promise<PetWithCaregivers[]> {
  const ids = pets.map((pet) => pet.id);
  const [members, links] = await Promise.all([
    listHouseholdMembers(supabase, householdId),
    ids.length ? supabase.from("pet_caregivers").select("pet_id, household_member_id").in("pet_id", ids) : Promise.resolve({ data: [], error: null }),
  ]);
  if (links.error) throw links.error;
  return Promise.all(pets.map(async (pet) => ({
    ...pet,
    caregivers: members.filter((member) => links.data?.some((link) => link.pet_id === pet.id && link.household_member_id === member.id)),
    photoUrl: await signedPhotoUrl(supabase, pet.photo_path),
  })));
}

export async function listPets(supabase: SupabaseClient<Database>, householdId: string, archived = false) {
  let query = supabase.from("pets").select("*").eq("household_id", householdId).order("created_at").order("id");
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return hydratePets(supabase, householdId, data ?? []);
}

export async function getPet(supabase: SupabaseClient<Database>, petId: string) {
  const { data, error } = await supabase.from("pets").select("*").eq("id", petId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await hydratePets(supabase, data.household_id, [data]))[0] ?? null;
}

export async function getPetHouseholdRole(supabase: SupabaseClient<Database>, householdId: string, userId: string): Promise<HouseholdRole | null> {
  const { data, error } = await supabase.from("household_members").select("role")
    .eq("household_id", householdId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data?.role ?? null;
}

type PetWrite = { id?: string; name: string; species: PetSpecies; breed: string | null; sex: PetSex | null; birthday: string | null; photoPath: string | null; caregiverIds: string[] };
export async function createPet(supabase: SupabaseClient<Database>, values: PetWrite & { id: string; householdId: string }) {
  const { data, error } = await supabase.rpc("create_pet", { p_id: values.id, p_household_id: values.householdId, p_name: values.name, p_species: values.species, p_breed: values.breed, p_sex: values.sex, p_birthday: values.birthday, p_photo_path: values.photoPath, p_caregiver_member_ids: values.caregiverIds });
  if (error) throw error;
  return data;
}
export async function updatePet(supabase: SupabaseClient<Database>, petId: string, values: PetWrite) {
  const { data, error } = await supabase.rpc("update_pet", { p_pet_id: petId, p_name: values.name, p_species: values.species, p_breed: values.breed, p_sex: values.sex, p_birthday: values.birthday, p_photo_path: values.photoPath, p_caregiver_member_ids: values.caregiverIds });
  if (error) throw error;
  return data;
}
export async function setPetArchived(supabase: SupabaseClient<Database>, petId: string, archived: boolean) {
  const { error } = await supabase.rpc("set_pet_archived", { p_pet_id: petId, p_archived: archived });
  if (error) throw error;
}
export async function uploadPetPhoto(supabase: SupabaseClient<Database>, path: string, file: File) {
  const { error } = await supabase.storage.from("pet-photos").upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
}
export async function deletePetPhoto(supabase: SupabaseClient<Database>, path: string) {
  await supabase.storage.from("pet-photos").remove([path]);
}

async function signedDocumentUrl(supabase: SupabaseClient<Database>, path: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("pet-documents").createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}

export async function listPetCareRecords(
  supabase: SupabaseClient<Database>,
  petId: string,
): Promise<PetCareRecordWithDocument[]> {
  const { data, error } = await supabase
    .from("pet_care_records")
    .select("*")
    .eq("pet_id", petId)
    .is("archived_at", null)
    .order("recorded_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return Promise.all((data ?? []).map(async (record) => ({
    ...record,
    documentUrl: await signedDocumentUrl(supabase, record.document_path),
  })));
}

export async function listScheduledPetCareRecords(
  supabase: SupabaseClient<Database>,
  householdId: string,
  start: string,
  end: string,
): Promise<(PetCareRecord & { pet: { name: string } | null })[]> {
  const { data, error } = await supabase
    .from("pet_care_records")
    .select("*, pet:pets(name)")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", start)
    .lt("scheduled_at", end)
    .order("scheduled_at");
  if (error) throw error;
  return (data ?? []) as unknown as (PetCareRecord & { pet: { name: string } | null })[];
}

export async function createPetCareRecord(
  supabase: SupabaseClient<Database>,
  record: Database["public"]["Tables"]["pet_care_records"]["Insert"],
) {
  const { error } = await supabase.from("pet_care_records").insert(record);
  if (error) throw error;
}

export async function archivePetCareRecord(
  supabase: SupabaseClient<Database>,
  recordId: string,
) {
  const { error } = await supabase
    .from("pet_care_records")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", recordId);
  if (error) throw error;
}

export async function uploadPetDocument(supabase: SupabaseClient<Database>, path: string, file: File) {
  const { error } = await supabase.storage.from("pet-documents").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
}

export async function deletePetDocument(supabase: SupabaseClient<Database>, path: string) {
  await supabase.storage.from("pet-documents").remove([path]);
}
