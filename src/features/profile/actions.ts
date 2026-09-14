"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { MEMBER_COLORS } from "@/features/household/domain/member";
import { requireUser } from "@/lib/auth/require-user";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { ActionState } from "@/lib/types/action-state";

import { deleteAvatar, getCurrentProfile, updateProfileDetails, uploadAvatar } from "./api";
import { avatarPath, AVATAR_MIME_EXTENSIONS, PROFILE_GENDERS, validateAvatarFile } from "./domain/profile";

const schema = z.object({
  householdId: z.string().uuid(),
  displayName: z.string().trim().min(1, "Display name is required").max(80),
  gender: z.union([z.enum(PROFILE_GENDERS), z.literal("")]).transform((value) => value || null),
  birthday: z.string().refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Invalid birthday")
    .refine((value) => value === "" || value <= new Date().toISOString().slice(0, 10), "Birthday cannot be in the future")
    .transform((value) => value || null),
  memberColor: z.enum(MEMBER_COLORS),
});

export async function updateProfileAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const parsed = schema.safeParse({
    householdId: formData.get("householdId"),
    displayName: formData.get("displayName"),
    gender: formData.get("gender"),
    birthday: formData.get("birthday"),
    memberColor: formData.get("memberColor"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const file = formData.get("avatar");
  const hasAvatar = file instanceof File && file.size > 0;
  if (hasAvatar) {
    const fileError = validateAvatarFile(file);
    if (fileError) return { error: fileError };
  }

  const current = await getCurrentProfile(supabase, user.id);
  if (!current) return { error: "Could not load profile" };
  let nextAvatar = current.avatar_url;
  let uploadedPath: string | null = null;
  if (hasAvatar) {
    uploadedPath = avatarPath(user.id, file.type as keyof typeof AVATAR_MIME_EXTENSIONS);
    try {
      await uploadAvatar(supabase, uploadedPath, file);
      nextAvatar = uploadedPath;
    } catch (error) {
      logDatabaseErrorInDev("updateProfileAction avatar upload failed", error);
      return { error: "Could not upload avatar" };
    }
  }

  try {
    await updateProfileDetails(supabase, { ...parsed.data, avatarUrl: nextAvatar });
  } catch (error) {
    logDatabaseErrorInDev("updateProfileAction profile update failed", error);
    if (uploadedPath && uploadedPath !== current.avatar_url) await deleteAvatar(supabase, uploadedPath);
    return { error: "Could not update profile" };
  }
  if (uploadedPath && current.avatar_url && current.avatar_url !== uploadedPath && !/^https?:\/\//.test(current.avatar_url)) {
    await deleteAvatar(supabase, current.avatar_url);
  }
  revalidatePath("/household/members");
  revalidatePath("/profile/edit");
  redirect("/household/members");
}
