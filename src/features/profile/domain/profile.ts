import type { ProfileGender } from "@/types/database";

export const PROFILE_GENDERS = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"] as const satisfies readonly ProfileGender[];
export const AVATAR_MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export const MAX_AVATAR_BYTES = 15 * 1024 * 1024;

export function validateAvatarFile(file: Pick<File, "size" | "type">): string | null {
  if (!(file.type in AVATAR_MIME_EXTENSIONS)) return "Use a JPEG, PNG, or WebP image";
  if (file.size > MAX_AVATAR_BYTES) return "Avatar must be 15 MB or smaller";
  return null;
}

export function avatarPath(userId: string, mimeType: keyof typeof AVATAR_MIME_EXTENSIONS): string {
  return `${userId}/avatar.${AVATAR_MIME_EXTENSIONS[mimeType]}`;
}

export function initials(displayName: string): string {
  return displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "?";
}
