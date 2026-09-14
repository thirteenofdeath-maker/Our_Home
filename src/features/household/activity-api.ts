import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeDatabaseMoney } from "@/lib/utils/money";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { Database } from "@/types/database";

/**
 * Wraps get_household_expense_activity (0051) — a SECURITY DEFINER RPC
 * that re-checks the CALLING user's CURRENT household membership itself
 * before returning anything (see the migration). This wrapper adds no
 * authorization of its own; a caller who is not a current member gets the
 * RPC's own rejection, surfaced here as a thrown error for the action/page
 * to turn into a friendly message — never a fallback to a direct table
 * query, which would bypass the membership re-check entirely.
 */

export interface HouseholdExpenseActivityItem {
  transactionId: string;
  originalTransactionId: string;
  isAdjustment: boolean;
  categoryId: string;
  categoryName: string;
  currency: string;
  /** Signed ledger-convention amount (negative = expense, positive = refund/reimbursement) — see the 0051 view's own contract. */
  amount: string;
  occurredAt: string;
  payerUserId: string;
  payerDisplayName: string;
}

interface HouseholdExpenseActivityWireItem {
  transaction_id: string;
  original_transaction_id: string;
  is_adjustment: boolean;
  category_id: string;
  category_name: string;
  currency: string;
  amount: string | number;
  occurred_at: string;
  payer_user_id: string;
  payer_display_name: string;
}

export async function getHouseholdExpenseActivity(
  supabase: SupabaseClient<Database>,
  params: { householdId: string; from: string; to: string },
): Promise<HouseholdExpenseActivityItem[]> {
  const { data, error } = await supabase.rpc("get_household_expense_activity", {
    p_household_id: params.householdId,
    p_from: params.from,
    p_to: params.to,
  });
  if (error) throw error;

  return ((data ?? []) as HouseholdExpenseActivityWireItem[]).map((wire) => ({
    transactionId: wire.transaction_id,
    originalTransactionId: wire.original_transaction_id,
    isAdjustment: wire.is_adjustment,
    categoryId: wire.category_id,
    categoryName: wire.category_name,
    currency: wire.currency,
    amount: normalizeDatabaseMoney(wire.amount),
    occurredAt: wire.occurred_at,
    payerUserId: wire.payer_user_id,
    payerDisplayName: wire.payer_display_name,
  }));
}

/**
 * Read-only convenience for the household activity page: same RPC, but
 * swallows/logs an error instead of throwing (a read page shows an empty
 * state, not a hard failure) — matching this codebase's established
 * "writes throw, reads swallow-and-log" split (see transactions/api.ts).
 */
export async function listHouseholdExpenseActivitySafe(
  supabase: SupabaseClient<Database>,
  params: { householdId: string; from: string; to: string },
): Promise<HouseholdExpenseActivityItem[]> {
  try {
    return await getHouseholdExpenseActivity(supabase, params);
  } catch (err) {
    logDatabaseErrorInDev("listHouseholdExpenseActivitySafe failed", err);
    return [];
  }
}
