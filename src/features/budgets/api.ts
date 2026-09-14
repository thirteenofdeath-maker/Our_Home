import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { Database } from "@/types/database";

import type { Budget, BudgetSummaryItem } from "./types";

interface BudgetSummaryWireItem {
  budget_id: string;
  category_id: string;
  category_name: string;
  category_archived: boolean;
  currency: string;
  period_month: string;
  budget_amount: string;
  net_spent: string;
  remaining: string;
  archived_at: string | null;
}

function mapWireItem(wire: BudgetSummaryWireItem): BudgetSummaryItem {
  return {
    budgetId: wire.budget_id,
    categoryId: wire.category_id,
    categoryName: wire.category_name,
    categoryArchived: wire.category_archived,
    currency: wire.currency,
    periodMonth: wire.period_month,
    budgetAmount: wire.budget_amount,
    netSpent: wire.net_spent,
    remaining: wire.remaining,
    archivedAt: wire.archived_at,
  };
}

/**
 * One batched RPC call for every Budget in one month (see get_budget_summary,
 * 0034) — never one spending query per Budget. Splits into active/archived
 * here so callers don't need to filter the same list twice.
 */
export async function getBudgetSummary(
  supabase: SupabaseClient<Database>,
  params: { periodMonth: string; monthStart: string; monthEnd: string },
): Promise<{ active: BudgetSummaryItem[]; archived: BudgetSummaryItem[] }> {
  const { data, error } = await supabase.rpc("get_budget_summary", {
    p_period_month: params.periodMonth,
    p_month_start: params.monthStart,
    p_month_end: params.monthEnd,
  });

  if (error) {
    logDatabaseErrorInDev("getBudgetSummary failed", error);
    return { active: [], archived: [] };
  }

  const items = ((data ?? []) as unknown as BudgetSummaryWireItem[]).map(mapWireItem);
  return {
    active: items.filter((item) => !item.archivedAt),
    archived: items.filter((item) => item.archivedAt),
  };
}

export async function getBudget(supabase: SupabaseClient<Database>, budgetId: string): Promise<Budget | null> {
  const { data, error } = await supabase.from("budgets").select("*").eq("id", budgetId).maybeSingle();
  if (error) {
    logDatabaseErrorInDev("getBudget failed", error);
    return null;
  }
  return data;
}

export async function createBudget(
  supabase: SupabaseClient<Database>,
  params: {
    scope: "PERSONAL" | "HOUSEHOLD";
    ownerUserId: string | null;
    householdId: string | null;
    categoryId: string;
    currency: string;
    periodMonth: string;
    amount: string;
    createdBy: string;
  },
): Promise<Budget> {
  const { data, error } = await supabase
    .from("budgets")
    .insert({
      scope: params.scope,
      owner_user_id: params.ownerUserId,
      household_id: params.householdId,
      category_id: params.categoryId,
      currency: params.currency,
      period_month: params.periodMonth,
      amount: params.amount,
      created_by: params.createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBudgetAmount(supabase: SupabaseClient<Database>, budgetId: string, amount: string): Promise<void> {
  const { error } = await supabase.from("budgets").update({ amount }).eq("id", budgetId);
  if (error) throw error;
}

/** Rejected by the `budgets_amount_positive_chk` constraint if amount <= 0 — not re-checked here, the DB is authoritative. */
export async function archiveBudget(supabase: SupabaseClient<Database>, budgetId: string): Promise<void> {
  const { error } = await supabase.from("budgets").update({ archived_at: new Date().toISOString() }).eq("id", budgetId);
  if (error) throw error;
}

/** Rejected by the unique index if an active Budget already occupies this identity (scope+category+currency+month). */
export async function restoreBudget(supabase: SupabaseClient<Database>, budgetId: string): Promise<void> {
  const { error } = await supabase.from("budgets").update({ archived_at: null }).eq("id", budgetId);
  if (error) throw error;
}
