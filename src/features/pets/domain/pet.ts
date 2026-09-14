import { z } from "zod";

import type { PetSex, PetSpecies } from "@/types/database";

export const PET_SPECIES = ["CAT", "DOG", "RABBIT", "BIRD", "FISH", "OTHER"] as const satisfies readonly PetSpecies[];
export const PET_SEXES = ["MALE", "FEMALE", "UNKNOWN"] as const satisfies readonly PetSex[];
export const PET_PHOTO_MIME_EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export const MAX_PET_PHOTO_BYTES = 15 * 1024 * 1024;

const optionalDate = z.string().refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Invalid birthday")
  .refine((value) => value === "" || value <= new Date().toISOString().slice(0, 10), "Birthday cannot be in the future")
  .transform((value) => value || null);

export const petFormSchema = z.object({
  name: z.string().trim().min(1, "Pet name is required").max(80),
  species: z.enum(PET_SPECIES),
  breed: z.string().trim().max(100).transform((value) => value || null),
  sex: z.union([z.enum(PET_SEXES), z.literal("")]).transform((value) => value || null),
  birthday: optionalDate,
  caregiverIds: z.array(z.string().uuid()),
});

export function validatePetPhoto(file: Pick<File, "size" | "type">): string | null {
  if (!(file.type in PET_PHOTO_MIME_EXTENSIONS)) return "Use a JPEG, PNG, or WebP image";
  if (file.size > MAX_PET_PHOTO_BYTES) return "Pet photo must be 15 MB or smaller";
  return null;
}

export function petPhotoPath(householdId: string, petId: string, mime: keyof typeof PET_PHOTO_MIME_EXTENSIONS) {
  return `${householdId}/${petId}/profile.${PET_PHOTO_MIME_EXTENSIONS[mime]}`;
}

export function petInitials(name: string) { return name.trim().slice(0, 2).toUpperCase() || "?"; }

export function ageFromBirthday(birthday: string | null, today = new Date()): number | null {
  if (!birthday) return null;
  const [year, month, day] = birthday.split("-").map(Number);
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--;
  return age;
}
