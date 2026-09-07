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
