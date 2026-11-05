import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type WorkspaceSummary = {
  tasks: { total: number; today: number; overdue: number; done: number };
  reminders: { today: number; overdue: number; upcoming: number; done: number };
  shopping: {
    pending: number;
    purchased: number;
    assigned: number;
    budget: number | null;
    currencies: number;
    currency: string | null;
  };
  inventory: { total: number; low: number; expiry: number; warranty: number };
};
export async function getWorkspaceSummary(
  client: SupabaseClient<Database>,
  householdId: string | null,
  today: string,
): Promise<WorkspaceSummary> {
  const { data, error } = await client.rpc("get_plan_workspace_summary", {
    p_household_id: householdId,
    p_today: today,
  });
  if (error) throw error;
  return data as unknown as WorkspaceSummary;
}
