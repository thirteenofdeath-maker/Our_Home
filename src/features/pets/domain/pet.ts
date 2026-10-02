import { z } from "zod";

import type { PetSex, PetSpecies } from "@/types/database";
import { ageOnBangkokDate, bangkokDateKey } from "@/lib/date/bangkok";

export const PET_SPECIES = ["CAT", "DOG", "RABBIT", "BIRD", "FISH", "OTHER"] as const satisfies readonly PetSpecies[];
export const PET_SEXES = ["MALE", "FEMALE", "UNKNOWN"] as const satisfies readonly PetSex[];
export const PET_PHOTO_MIME_EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
/** Keep the complete multipart request safely below Vercel's 4.5 MB limit. */
export const MAX_PET_PHOTO_BYTES = 3.5 * 1024 * 1024;
export const MAX_PET_PHOTO_SOURCE_BYTES = 15 * 1024 * 1024;

const optionalDate = z.string().refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Invalid birthday")
  .refine((value) => value === "" || value <= bangkokDateKey(), "Birthday cannot be in the future")
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
  if (file.size > MAX_PET_PHOTO_BYTES) return "รูปสัตว์เลี้ยงมีขนาดใหญ่เกินไป กรุณาเลือกใหม่";
  return null;
}

export function validatePetPhotoSource(file: Pick<File, "size" | "type">): string | null {
  if (![
    ...Object.keys(PET_PHOTO_MIME_EXTENSIONS),
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
  ].includes(file.type.toLowerCase())) return "รองรับเฉพาะรูป JPEG, PNG, WebP, HEIC หรือ HEIF";
  if (file.size > MAX_PET_PHOTO_SOURCE_BYTES) return "รูปต้นฉบับต้องมีขนาดไม่เกิน 15 MB";
  return null;
}

export function petPhotoPath(householdId: string, petId: string, mime: keyof typeof PET_PHOTO_MIME_EXTENSIONS) {
  return `${householdId}/${petId}/profile.${PET_PHOTO_MIME_EXTENSIONS[mime]}`;
}

export function petInitials(name: string) { return name.trim().slice(0, 2).toUpperCase() || "?"; }

export function ageFromBirthday(birthday: string | null, today = new Date()): number | null {
  return ageOnBangkokDate(birthday, today);
}
