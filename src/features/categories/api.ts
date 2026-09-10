import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
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
  let customQuery = supabase
    .from("categories")
    .select("*")
    .eq("transaction_type", params.transactionType)
    .eq("is_system", false)
    .order("sort_order", { ascending: true });

  if (params.scope) {
    customQuery = customQuery.eq("scope", params.scope);
  }
  if (!params.includeArchived) {
    customQuery = customQuery.is("archived_at", null);
  }

  let systemQuery = supabase
    .from("categories")
    .select("*")
    .eq("transaction_type", params.transactionType)
    .eq("is_system", true)
    .order("sort_order", { ascending: true });
  if (!params.includeArchived) systemQuery = systemQuery.is("archived_at", null);

  const [systemResult, customResult] = await Promise.all([systemQuery, customQuery]);
  if (systemResult.error) logDatabaseErrorInDev("listCategories system query failed", systemResult.error);
  if (customResult.error) logDatabaseErrorInDev("listCategories custom query failed", customResult.error);
  return mergeAndSortCategories(systemResult.data, customResult.data);
}

/**
 * Categories applicable to a specific wallet: personal categories owned by
 * that wallet's owner, or categories belonging to that exact household —
 * never "every category visible through RLS" (a user can own personal
 * categories from unrelated contexts, or belong to more than one
 * household, and RLS alone does not narrow to the one wallet in play).
 *
 * Deliberately plain chained `.eq()` filters, not a hand-built PostgREST
 * `or(...,and(...))` string. PERSONAL and HOUSEHOLD are mutually
 * exclusive, so there is no OR to express in the first place — the
 * previous version's `is_system.eq.true,and(scope.eq...,owner_user_id.eq...)`
 * was solving a problem ("also include is_system categories") that
 * doesn't exist yet (Milestone 1 seeds none), while making the one filter
 * that DOES matter — "this wallet's own categories" — needlessly fragile
 * to get right and silently swallowed into an empty result on any query
 * error (see the `error ? [] : data` below). When `is_system` categories
 * are actually introduced, add them back as a small, separately-tested
 * second query merged in, rather than reintroducing string-built logical
 * operators.
 */
export async function listCategoriesForWallet(
  supabase: SupabaseClient<Database>,
  params: {
    transactionType: CategoryTransactionType;
    wallet: { scope: "PERSONAL" | "HOUSEHOLD"; owner_user_id: string | null; household_id: string | null };
    includeArchived?: boolean;
  },
): Promise<Category[]> {
  let systemQuery = supabase
    .from("categories")
    .select("*")
    .eq("transaction_type", params.transactionType)
    .eq("is_system", true);
  let customQuery = supabase
    .from("categories")
    .select("*")
    .eq("transaction_type", params.transactionType)
    .eq("is_system", false)
    .eq("scope", params.wallet.scope);

  customQuery =
    params.wallet.scope === "PERSONAL"
      ? customQuery.eq("owner_user_id", params.wallet.owner_user_id!)
      : customQuery.eq("household_id", params.wallet.household_id!);

  if (!params.includeArchived) {
    systemQuery = systemQuery.is("archived_at", null);
    customQuery = customQuery.is("archived_at", null);
  }
  systemQuery = systemQuery.order("sort_order", { ascending: true });
  customQuery = customQuery.order("sort_order", { ascending: true });

  const [systemResult, customResult] = await Promise.all([systemQuery, customQuery]);
  if (systemResult.error) logDatabaseErrorInDev("listCategoriesForWallet system query failed", systemResult.error);
  if (customResult.error) logDatabaseErrorInDev("listCategoriesForWallet custom query failed", customResult.error);
  return mergeAndSortCategories(systemResult.data, customResult.data);
}

function mergeAndSortCategories(system: Category[] | null, custom: Category[] | null): Category[] {
  const unique = new Map<string, Category>();
  for (const category of [...(system ?? []), ...(custom ?? [])]) unique.set(category.id, category);
  return [...unique.values()].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "th") || a.id.localeCompare(b.id),
  );
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
