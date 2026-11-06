import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { BirthdaySource } from "./domain/birthdays";

export async function listSharedBirthdays(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<BirthdaySource[]> {
  const { data, error } = await supabase.rpc("get_calendar_export_birthdays", {
    p_household_id: householdId,
  });
  if (error) throw error;
  return (data ?? []).flatMap((row) =>
    row.subject_type === "MEMBER" || row.subject_type === "PET"
      ? [{ ...row, subject_type: row.subject_type }]
      : [],
  );
}
