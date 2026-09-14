import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export async function getCurrentProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await supabase.rpc("get_own_profile", {});
  if (error) {
    logDatabaseErrorInDev("getCurrentProfile failed", error);
    return null;
  }
  return data?.id === userId ? data : null;
}

export async function getAvatarDisplayUrl(supabase: SupabaseClient<Database>, storedValue: string | null): Promise<string | null> {
  if (!storedValue || /^https?:\/\//.test(storedValue)) return storedValue;
  const { data, error } = await supabase.storage.from("avatars").createSignedUrl(storedValue, 3600);
  if (error) {
    logDatabaseErrorInDev("getAvatarDisplayUrl failed", error);
    return null;
  }
  return data.signedUrl;
}

export async function uploadAvatar(supabase: SupabaseClient<Database>, path: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
}

export async function deleteAvatar(supabase: SupabaseClient<Database>, path: string): Promise<void> {
  const { error } = await supabase.storage.from("avatars").remove([path]);
  if (error) logDatabaseErrorInDev("deleteAvatar failed", error);
}

export async function updateProfileDetails(
  supabase: SupabaseClient<Database>,
  params: { householdId: string; displayName: string; gender: Profile["gender"]; birthday: string | null; memberColor: string; avatarUrl: string | null },
): Promise<void> {
  const { error } = await supabase.rpc("update_profile_details", {
    p_household_id: params.householdId,
    p_display_name: params.displayName,
    p_gender: params.gender,
    p_birthday: params.birthday,
    p_member_color: params.memberColor,
    p_avatar_url: params.avatarUrl,
  });
  if (error) throw error;
}
