import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { shiftMonth } from "@/features/calendar/domain/calendar";
import type { Database } from "@/types/database";
import type { HouseholdExpense } from "./domain";

export async function listHouseholdExpenses(
  supabase: SupabaseClient<Database>,
  householdId: string,
  month: string,
) {
  const rows: HouseholdExpense[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("household_expenses")
      .select("*")
      .eq("household_id", householdId)
      .gte("paid_on", `${month}-01`)
      .lt("paid_on", `${shiftMonth(month, 1)}-01`)
      .order("paid_on", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}
