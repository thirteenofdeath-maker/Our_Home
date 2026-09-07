import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CategoryTransactionType, Database } from "@/types/database";

import type { Category } from "./types";

export async function listCategories(
  supabase: SupabaseClient<Database>,
  params: {
    transactionType: CategoryTransactionType;
    scope?: "PERSONAL" | "HOUSEHOLD";
    includeArchived?: boolean;
  },
): Promise<Category[]> {
  let query = supabase
    .from("categories")
    .select("*")
    .eq("transaction_type", params.transactionType)
    .order("sort_order", { ascending: true });

  if (params.scope) {
    query = query.eq("scope", params.scope);
  }
  if (!params.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data;
}

/**
 * Categories applicable to a specific wallet: personal categories owned by
 * that wallet's owner, or categories belonging to that exact household —
 * never "every category visible through RLS" (a user can own personal
 * categories from unrelated contexts, or belong to more than one
 * household, and RLS alone does not narrow to the one wallet in play).
 * `is_system` categories (none seeded in Milestone 1) are included for
 * every wallet regardless of scope, once they exist.
 */
export async function listCategoriesForWallet(
  supabase: SupabaseClient<Database>,
  params: {
    transactionType: CategoryTransactionType;
    wallet: { scope: "PERSONAL" | "HOUSEHOLD"; owner_user_id: string | null; household_id: string | null };
    includeArchived?: boolean;
  },
): Promise<Category[]> {
  let query = supabase.from("categories").select("*").eq("transaction_type", params.transactionType);

  query =
    params.wallet.scope === "PERSONAL"
      ? query.or(`is_system.eq.true,and(scope.eq.PERSONAL,owner_user_id.eq.${params.wallet.owner_user_id})`)
      : query.or(`is_system.eq.true,and(scope.eq.HOUSEHOLD,household_id.eq.${params.wallet.household_id})`);

  if (!params.includeArchived) {
    query = query.is("archived_at", null);
  }
  query = query.order("sort_order", { ascending: true });

  const { data, error } = await query;
  if (error || !data) return [];
  return data;
}

export async function createCategory(
  supabase: SupabaseClient<Database>,
  params: {
    name: string;
    transactionType: CategoryTransactionType;
    parentId: string | null;
    scope: "PERSONAL" | "HOUSEHOLD";
    ownerUserId: string | null;
    householdId: string | null;
    createdBy: string;
  },
): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: params.name,
      transaction_type: params.transactionType,
      parent_id: params.parentId,
      scope: params.scope,
      owner_user_id: params.ownerUserId,
      household_id: params.householdId,
      created_by: params.createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function archiveCategory(supabase: SupabaseClient<Database>, id: string): Promise<void> {
  const { error } = await supabase.from("categories").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function restoreCategory(supabase: SupabaseClient<Database>, id: string): Promise<void> {
  const { error } = await supabase.from("categories").update({ archived_at: null }).eq("id", id);
  if (error) throw error;
}

export async function renameCategory(
  supabase: SupabaseClient<Database>,
  id: string,
  name: string,
): Promise<void> {
  const { error } = await supabase.from("categories").update({ name }).eq("id", id);
  if (error) throw error;
}
