import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { Database } from "@/types/database";

import type { Tag, TagOption } from "./types";

export async function listTags(
  supabase: SupabaseClient<Database>,
  params: { scope: "PERSONAL" | "HOUSEHOLD"; householdId?: string | null; includeArchived?: boolean },
): Promise<Tag[]> {
  let query = supabase.from("tags").select("*").eq("scope", params.scope);
  if (params.scope === "HOUSEHOLD" && params.householdId) {
    query = query.eq("household_id", params.householdId);
  }
  if (!params.includeArchived) {
    query = query.is("archived_at", null);
  }
  query = query.order("name", { ascending: true });

  const { data, error } = await query;
  if (error) {
    logDatabaseErrorInDev("listTags failed", error);
    return [];
  }
  return data ?? [];
}

export async function createTag(
  supabase: SupabaseClient<Database>,
  params: { name: string; scope: "PERSONAL" | "HOUSEHOLD"; ownerUserId: string | null; householdId: string | null; createdBy: string },
): Promise<Tag> {
  const { data, error } = await supabase
    .from("tags")
    .insert({
      name: params.name,
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

export async function renameTag(supabase: SupabaseClient<Database>, id: string, name: string): Promise<void> {
  const { error } = await supabase.from("tags").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function archiveTag(supabase: SupabaseClient<Database>, id: string): Promise<void> {
  const { error } = await supabase.from("tags").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function restoreTag(supabase: SupabaseClient<Database>, id: string): Promise<void> {
  const { error } = await supabase.from("tags").update({ archived_at: null }).eq("id", id);
  if (error) throw error;
}

/**
 * Atomically replaces one transaction's tag set (set_transaction_tags,
 * 0032). Rejects the WHOLE request if any tag id is invalid, archived, or
 * scope-incompatible — there is no partial-apply outcome to handle here.
 */
export async function setTransactionTags(supabase: SupabaseClient<Database>, transactionId: string, tagIds: string[]): Promise<void> {
  const { error } = await supabase.rpc("set_transaction_tags", { p_transaction_id: transactionId, p_tag_ids: tagIds });
  if (error) throw error;
}

interface RawTransactionTagRow {
  transaction_id: string;
  tag: { id: string; name: string } | null;
}

/**
 * Batched — one query for however many transaction ids are passed, never
 * one query per transaction (see docs/FINANCE.md Phase C "Performance").
 * Returns a Map so callers can look up `get(transactionId) ?? []`.
 */
export async function listTagsForTransactions(
  supabase: SupabaseClient<Database>,
  transactionIds: string[],
): Promise<Map<string, TagOption[]>> {
  const result = new Map<string, TagOption[]>();
  if (transactionIds.length === 0) return result;

  const { data, error } = await supabase
    .from("transaction_tags")
    .select("transaction_id, tag:tags(id, name)")
    .in("transaction_id", transactionIds);

  if (error) {
    logDatabaseErrorInDev("listTagsForTransactions failed", error);
    return result;
  }

  for (const row of (data ?? []) as unknown as RawTransactionTagRow[]) {
    if (!row.tag) continue;
    const existing = result.get(row.transaction_id) ?? [];
    existing.push({ id: row.tag.id, name: row.tag.name });
    result.set(row.transaction_id, existing);
  }
  return result;
}

export async function listTagsForTransaction(supabase: SupabaseClient<Database>, transactionId: string): Promise<TagOption[]> {
  const map = await listTagsForTransactions(supabase, [transactionId]);
  return map.get(transactionId) ?? [];
}
