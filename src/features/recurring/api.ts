import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import { normalizeDatabaseMoney } from "@/lib/utils/money";
import type { Database } from "@/types/database";

import type { OccurrenceStatus, OccurrenceSummary, RecurringFrequency, RecurringSummary, RecurringTransaction } from "./types";

const RULE_SELECT =
  "id, scope, owner_user_id, household_id, transaction_type, name, amount, title, note, frequency, interval_count, start_date, end_date, paused_at, archived_at, wallet_id, wallet:wallets(name, is_archived), pocket_id, pocket:pockets(name, is_archived), category_id, category:categories(name, archived_at)";

interface RawRuleRow {
  id: string;
  scope: "PERSONAL" | "HOUSEHOLD";
  owner_user_id: string | null;
  household_id: string | null;
  transaction_type: "INCOME" | "EXPENSE";
  name: string;
  amount: string | number;
  title: string | null;
  note: string | null;
  frequency: RecurringFrequency;
  interval_count: number;
  start_date: string;
  end_date: string | null;
  paused_at: string | null;
  archived_at: string | null;
  wallet_id: string | null;
  wallet: { name: string; is_archived: boolean } | null;
  pocket_id: string | null;
  pocket: { name: string; is_archived: boolean } | null;
  category_id: string | null;
  category: { name: string; archived_at: string | null } | null;
}

interface RawRuleTagRow {
  recurring_transaction_id: string;
  tag: { id: string; name: string; archived_at: string | null } | null;
}

/** Batched — one query for however many rule ids, never one per rule. */
async function listTagsForRules(
  supabase: SupabaseClient<Database>,
  ruleIds: string[],
): Promise<Map<string, Array<{ id: string; name: string; archivedAt: string | null }>>> {
  const result = new Map<string, Array<{ id: string; name: string; archivedAt: string | null }>>();
  if (ruleIds.length === 0) return result;

  const { data, error } = await supabase
    .from("recurring_transaction_tags")
    .select("recurring_transaction_id, tag:tags(id, name, archived_at)")
    .in("recurring_transaction_id", ruleIds);

  if (error) {
    logDatabaseErrorInDev("listTagsForRules failed", error);
    return result;
  }

  for (const row of (data ?? []) as unknown as RawRuleTagRow[]) {
    if (!row.tag) continue;
    const existing = result.get(row.recurring_transaction_id) ?? [];
    existing.push({ id: row.tag.id, name: row.tag.name, archivedAt: row.tag.archived_at });
    result.set(row.recurring_transaction_id, existing);
  }
  return result;
}

function mapRuleRow(row: RawRuleRow, tags: Array<{ id: string; name: string; archivedAt: string | null }>): RecurringSummary {
  return {
    recurringId: row.id,
    scope: row.scope,
    ownerUserId: row.owner_user_id,
    householdId: row.household_id,
    transactionType: row.transaction_type,
    name: row.name,
    amount: normalizeDatabaseMoney(row.amount),
    title: row.title,
    note: row.note,
    frequency: row.frequency,
    intervalCount: row.interval_count,
    startDate: row.start_date,
    endDate: row.end_date,
    pausedAt: row.paused_at,
    archivedAt: row.archived_at,
    walletId: row.wallet_id,
    walletName: row.wallet?.name ?? null,
    walletArchived: row.wallet?.is_archived ?? false,
    pocketId: row.pocket_id,
    pocketName: row.pocket?.name ?? null,
    pocketArchived: row.pocket?.is_archived ?? false,
    categoryId: row.category_id,
    categoryName: row.category?.name ?? null,
    categoryArchived: row.category?.archived_at != null,
    tags,
  };
}

export async function listRecurringTransactions(
  supabase: SupabaseClient<Database>,
  params: { scope: "PERSONAL" | "HOUSEHOLD"; householdId?: string | null; includeArchived?: boolean },
): Promise<RecurringSummary[]> {
  let query = supabase.from("recurring_transactions").select(RULE_SELECT).eq("scope", params.scope);
  if (params.scope === "HOUSEHOLD" && params.householdId) {
    query = query.eq("household_id", params.householdId);
  }
  if (!params.includeArchived) {
    query = query.is("archived_at", null);
  }
  query = query.order("name", { ascending: true });

  const { data, error } = await query;
  if (error) {
    logDatabaseErrorInDev("listRecurringTransactions failed", error);
    return [];
  }

  const rows = (data ?? []) as unknown as RawRuleRow[];
  const tagsByRule = await listTagsForRules(
    supabase,
    rows.map((row) => row.id),
  );
  return rows.map((row) => mapRuleRow(row, tagsByRule.get(row.id) ?? []));
}

export async function getRecurringTransaction(supabase: SupabaseClient<Database>, recurringId: string): Promise<RecurringSummary | null> {
  const { data, error } = await supabase.from("recurring_transactions").select(RULE_SELECT).eq("id", recurringId).maybeSingle();
  if (error) {
    logDatabaseErrorInDev("getRecurringTransaction failed", error);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as RawRuleRow;
  const tagsByRule = await listTagsForRules(supabase, [row.id]);
  return mapRuleRow(row, tagsByRule.get(row.id) ?? []);
}

export async function createRecurringTransaction(
  supabase: SupabaseClient<Database>,
  params: {
    scope: "PERSONAL" | "HOUSEHOLD";
    ownerUserId: string | null;
    householdId: string | null;
    transactionType: "INCOME" | "EXPENSE";
    name: string;
    walletId?: string | null;
    pocketId?: string | null;
    categoryId?: string | null;
    amount: string;
    title?: string | null;
    note?: string | null;
    frequency: RecurringFrequency;
    intervalCount: number;
    startDate: string;
    endDate?: string | null;
    createdBy: string;
  },
): Promise<RecurringTransaction> {
  const { data, error } = await supabase
    .from("recurring_transactions")
    .insert({
      scope: params.scope,
      owner_user_id: params.ownerUserId,
      household_id: params.householdId,
      transaction_type: params.transactionType,
      name: params.name,
      wallet_id: params.walletId ?? null,
      pocket_id: params.pocketId ?? null,
      category_id: params.categoryId ?? null,
      amount: params.amount,
      title: params.title ?? null,
      note: params.note ?? null,
      frequency: params.frequency,
      interval_count: params.intervalCount,
      start_date: params.startDate,
      end_date: params.endDate ?? null,
      created_by: params.createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateRecurringTransaction(
  supabase: SupabaseClient<Database>,
  recurringId: string,
  params: {
    name: string;
    walletId?: string | null;
    pocketId?: string | null;
    categoryId?: string | null;
    amount: string;
    title?: string | null;
    note?: string | null;
    frequency: RecurringFrequency;
    intervalCount: number;
    startDate: string;
    endDate?: string | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from("recurring_transactions")
    .update({
      name: params.name,
      wallet_id: params.walletId ?? null,
      pocket_id: params.pocketId ?? null,
      category_id: params.categoryId ?? null,
      amount: params.amount,
      title: params.title ?? null,
      note: params.note ?? null,
      frequency: params.frequency,
      interval_count: params.intervalCount,
      start_date: params.startDate,
      end_date: params.endDate ?? null,
    })
    .eq("id", recurringId);
  if (error) throw error;
}

export async function pauseRecurringTransaction(supabase: SupabaseClient<Database>, recurringId: string): Promise<void> {
  const { error } = await supabase.from("recurring_transactions").update({ paused_at: new Date().toISOString() }).eq("id", recurringId);
  if (error) throw error;
}

export async function resumeRecurringTransaction(supabase: SupabaseClient<Database>, recurringId: string): Promise<void> {
  const { error } = await supabase.from("recurring_transactions").update({ paused_at: null }).eq("id", recurringId);
  if (error) throw error;
}

export async function archiveRecurringTransaction(supabase: SupabaseClient<Database>, recurringId: string): Promise<void> {
  const { error } = await supabase.from("recurring_transactions").update({ archived_at: new Date().toISOString() }).eq("id", recurringId);
  if (error) throw error;
}

export async function restoreRecurringTransaction(supabase: SupabaseClient<Database>, recurringId: string): Promise<void> {
  const { error } = await supabase.from("recurring_transactions").update({ archived_at: null }).eq("id", recurringId);
  if (error) throw error;
}

export async function setRecurringTransactionTags(supabase: SupabaseClient<Database>, recurringId: string, tagIds: string[]): Promise<void> {
  const { error } = await supabase.rpc("set_recurring_transaction_tags", { p_recurring_id: recurringId, p_tag_ids: tagIds });
  if (error) throw error;
}

/** Idempotent, bounded — call before any occurrence read (docs/FINANCE.md Phase G). */
export async function materializeRecurringOccurrences(
  supabase: SupabaseClient<Database>,
  params: { scope: "PERSONAL" | "HOUSEHOLD"; householdId?: string | null },
): Promise<void> {
  const { error } = await supabase.rpc("materialize_recurring_occurrences", {
    p_scope: params.scope,
    p_household_id: params.householdId ?? null,
  });
  if (error) logDatabaseErrorInDev("materializeRecurringOccurrences failed", error);
}

// ---------------------------------------------------------------------
// Occurrences — always read joined with their rule's full prefill
// context (wallet/pocket/category/tags + stale flags), so a list row
// and the posting flow's prefill come from the same shape, never a
// second lookup.
// ---------------------------------------------------------------------

const OCCURRENCE_SELECT = `id, due_date, status, posted_transaction_id, posted_at, skipped_at,
  recurring_transaction:recurring_transactions(id, scope, owner_user_id, household_id, transaction_type, name, amount, title, note,
    wallet_id, wallet:wallets(name, is_archived, currency), pocket_id, pocket:pockets(name, is_archived), category_id, category:categories(name, archived_at)),
  posted_transaction:transactions(deleted_at)`;

interface RawOccurrenceRow {
  id: string;
  due_date: string;
  status: OccurrenceStatus;
  posted_transaction_id: string | null;
  posted_at: string | null;
  skipped_at: string | null;
  recurring_transaction: {
    id: string;
    scope: "PERSONAL" | "HOUSEHOLD";
    owner_user_id: string | null;
    household_id: string | null;
    transaction_type: "INCOME" | "EXPENSE";
    name: string;
    amount: string | number;
    title: string | null;
    note: string | null;
    wallet_id: string | null;
    wallet: { name: string; is_archived: boolean; currency: string } | null;
    pocket_id: string | null;
    pocket: { name: string; is_archived: boolean } | null;
    category_id: string | null;
    category: { name: string; archived_at: string | null } | null;
  } | null;
  posted_transaction: { deleted_at: string | null } | null;
}

function mapOccurrenceRow(row: RawOccurrenceRow, tags: Array<{ id: string; name: string; archivedAt: string | null }>): OccurrenceSummary | null {
  const rule = row.recurring_transaction;
  if (!rule) return null;
  return {
    occurrenceId: row.id,
    dueDate: row.due_date,
    status: row.status,
    postedTransactionId: row.posted_transaction_id,
    postedAt: row.posted_at,
    skippedAt: row.skipped_at,
    postedTransactionVoided: row.posted_transaction?.deleted_at != null,
    recurringId: rule.id,
    scope: rule.scope,
    ownerUserId: rule.owner_user_id,
    householdId: rule.household_id,
    transactionType: rule.transaction_type,
    name: rule.name,
    amount: normalizeDatabaseMoney(rule.amount),
    title: rule.title,
    note: rule.note,
    walletId: rule.wallet_id,
    walletName: rule.wallet?.name ?? null,
    walletArchived: rule.wallet?.is_archived ?? false,
    walletCurrency: rule.wallet?.currency ?? null,
    pocketId: rule.pocket_id,
    pocketName: rule.pocket?.name ?? null,
    pocketArchived: rule.pocket?.is_archived ?? false,
    categoryId: rule.category_id,
    categoryName: rule.category?.name ?? null,
    categoryArchived: rule.category?.archived_at != null,
    tags,
  };
}

/** Every occurrence belonging to the given rule ids, newest-due-first-excluded — ordered soonest due date first. */
export async function listOccurrencesForRules(
  supabase: SupabaseClient<Database>,
  ruleIds: string[],
  params?: { status?: OccurrenceStatus; limit?: number },
): Promise<OccurrenceSummary[]> {
  if (ruleIds.length === 0) return [];

  let query = supabase.from("recurring_occurrences").select(OCCURRENCE_SELECT).in("recurring_transaction_id", ruleIds);
  if (params?.status) query = query.eq("status", params.status);
  query = query.order("due_date", { ascending: true });
  if (params?.limit) query = query.limit(params.limit);

  const { data, error } = await query;
  if (error) {
    logDatabaseErrorInDev("listOccurrencesForRules failed", error);
    return [];
  }

  const rows = (data ?? []) as unknown as RawOccurrenceRow[];
  const tagsByRule = await listTagsForRules(supabase, ruleIds);
  return rows.map((row) => mapOccurrenceRow(row, tagsByRule.get(row.recurring_transaction?.id ?? "") ?? [])).filter((row): row is OccurrenceSummary => row !== null);
}

export async function listOccurrencesForRule(supabase: SupabaseClient<Database>, recurringId: string): Promise<OccurrenceSummary[]> {
  return listOccurrencesForRules(supabase, [recurringId]);
}

/**
 * Only rules that are currently active (not paused, not archived) — a
 * paused/archived rule's own outstanding UPCOMING occurrences stay
 * fully visible/actionable on that rule's own detail page, but do not
 * surface in this global "upcoming" feed (docs/FINANCE.md Phase G
 * "Pause"/"Archive").
 */
export async function listUpcomingOccurrencesForScope(
  supabase: SupabaseClient<Database>,
  params: { scope: "PERSONAL" | "HOUSEHOLD"; householdId?: string | null; limit?: number },
): Promise<OccurrenceSummary[]> {
  const rules = await listRecurringTransactions(supabase, { scope: params.scope, householdId: params.householdId });
  const activeRuleIds = rules.filter((rule) => !rule.pausedAt).map((rule) => rule.recurringId);
  return listOccurrencesForRules(supabase, activeRuleIds, { status: "UPCOMING", limit: params.limit });
}

export async function getOccurrence(supabase: SupabaseClient<Database>, occurrenceId: string): Promise<OccurrenceSummary | null> {
  const { data, error } = await supabase.from("recurring_occurrences").select(OCCURRENCE_SELECT).eq("id", occurrenceId).maybeSingle();
  if (error) {
    logDatabaseErrorInDev("getOccurrence failed", error);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as RawOccurrenceRow;
  if (!row.recurring_transaction) return null;
  const tagsByRule = await listTagsForRules(supabase, [row.recurring_transaction.id]);
  return mapOccurrenceRow(row, tagsByRule.get(row.recurring_transaction.id) ?? []);
}

export async function postRecurringOccurrence(
  supabase: SupabaseClient<Database>,
  params: {
    occurrenceId: string;
    walletId: string;
    pocketId: string;
    categoryId: string;
    amount: string;
    title?: string | null;
    note?: string | null;
    occurredAt?: string;
    tagIds?: string[];
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("post_recurring_occurrence", {
    p_occurrence_id: params.occurrenceId,
    p_wallet_id: params.walletId,
    p_pocket_id: params.pocketId,
    p_category_id: params.categoryId,
    p_amount: params.amount,
    p_title: params.title ?? null,
    p_note: params.note ?? null,
    p_occurred_at: params.occurredAt,
    p_tag_ids: params.tagIds?.length ? params.tagIds : null,
  });
  if (error) throw error;
  return data;
}

export async function skipRecurringOccurrence(supabase: SupabaseClient<Database>, occurrenceId: string): Promise<void> {
  const { error } = await supabase.rpc("skip_recurring_occurrence", { p_occurrence_id: occurrenceId });
  if (error) throw error;
}
