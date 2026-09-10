import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import { normalizeDatabaseMoney } from "@/lib/utils/money";
import type { Database } from "@/types/database";

import type { TemplateSummary, TransactionTemplate } from "./types";

const TEMPLATE_SELECT =
  "id, scope, owner_user_id, household_id, transaction_type, name, amount, title, note, archived_at, wallet_id, wallet:wallets(name, is_archived), pocket_id, pocket:pockets(name, is_archived), category_id, category:categories(name, archived_at)";

interface RawTemplateRow {
  id: string;
  scope: "PERSONAL" | "HOUSEHOLD";
  owner_user_id: string | null;
  household_id: string | null;
  transaction_type: "INCOME" | "EXPENSE";
  name: string;
  amount: string | number | null;
  title: string | null;
  note: string | null;
  archived_at: string | null;
  wallet_id: string | null;
  wallet: { name: string; is_archived: boolean } | null;
  pocket_id: string | null;
  pocket: { name: string; is_archived: boolean } | null;
  category_id: string | null;
  category: { name: string; archived_at: string | null } | null;
}

interface RawTemplateTagRow {
  template_id: string;
  tag: { id: string; name: string; archived_at: string | null } | null;
}

/**
 * Batched — one query for however many template ids, never one query per
 * template (see docs/FINANCE.md Phase F "Performance"). Includes archived
 * tags (for historical display); a caller that needs only usable tags
 * (e.g. prefilling a new transaction) filters `archivedAt === null` itself.
 */
async function listTagsForTemplates(
  supabase: SupabaseClient<Database>,
  templateIds: string[],
): Promise<Map<string, Array<{ id: string; name: string; archivedAt: string | null }>>> {
  const result = new Map<string, Array<{ id: string; name: string; archivedAt: string | null }>>();
  if (templateIds.length === 0) return result;

  const { data, error } = await supabase
    .from("transaction_template_tags")
    .select("template_id, tag:tags(id, name, archived_at)")
    .in("template_id", templateIds);

  if (error) {
    logDatabaseErrorInDev("listTagsForTemplates failed", error);
    return result;
  }

  for (const row of (data ?? []) as unknown as RawTemplateTagRow[]) {
    if (!row.tag) continue;
    const existing = result.get(row.template_id) ?? [];
    existing.push({ id: row.tag.id, name: row.tag.name, archivedAt: row.tag.archived_at });
    result.set(row.template_id, existing);
  }
  return result;
}

function mapRow(row: RawTemplateRow, tags: Array<{ id: string; name: string; archivedAt: string | null }>): TemplateSummary {
  return {
    templateId: row.id,
    scope: row.scope,
    ownerUserId: row.owner_user_id,
    householdId: row.household_id,
    transactionType: row.transaction_type,
    name: row.name,
    amount: row.amount === null ? null : normalizeDatabaseMoney(row.amount),
    title: row.title,
    note: row.note,
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

export async function listTemplates(
  supabase: SupabaseClient<Database>,
  params: { scope: "PERSONAL" | "HOUSEHOLD"; householdId?: string | null; includeArchived?: boolean },
): Promise<TemplateSummary[]> {
  let query = supabase.from("transaction_templates").select(TEMPLATE_SELECT).eq("scope", params.scope);
  if (params.scope === "HOUSEHOLD" && params.householdId) {
    query = query.eq("household_id", params.householdId);
  }
  if (!params.includeArchived) {
    query = query.is("archived_at", null);
  }
  query = query.order("name", { ascending: true });

  const { data, error } = await query;
  if (error) {
    logDatabaseErrorInDev("listTemplates failed", error);
    return [];
  }

  const rows = (data ?? []) as unknown as RawTemplateRow[];
  const tagsByTemplate = await listTagsForTemplates(
    supabase,
    rows.map((row) => row.id),
  );
  return rows.map((row) => mapRow(row, tagsByTemplate.get(row.id) ?? []));
}

export async function getTemplate(supabase: SupabaseClient<Database>, templateId: string): Promise<TemplateSummary | null> {
  const { data, error } = await supabase.from("transaction_templates").select(TEMPLATE_SELECT).eq("id", templateId).maybeSingle();
  if (error) {
    logDatabaseErrorInDev("getTemplate failed", error);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as RawTemplateRow;
  const tagsByTemplate = await listTagsForTemplates(supabase, [row.id]);
  return mapRow(row, tagsByTemplate.get(row.id) ?? []);
}

export async function createTemplate(
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
    amount?: string | null;
    title?: string | null;
    note?: string | null;
    createdBy: string;
  },
): Promise<TransactionTemplate> {
  const { data, error } = await supabase
    .from("transaction_templates")
    .insert({
      scope: params.scope,
      owner_user_id: params.ownerUserId,
      household_id: params.householdId,
      transaction_type: params.transactionType,
      name: params.name,
      wallet_id: params.walletId ?? null,
      pocket_id: params.pocketId ?? null,
      category_id: params.categoryId ?? null,
      amount: params.amount ?? null,
      title: params.title ?? null,
      note: params.note ?? null,
      created_by: params.createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTemplate(
  supabase: SupabaseClient<Database>,
  templateId: string,
  params: {
    name: string;
    walletId?: string | null;
    pocketId?: string | null;
    categoryId?: string | null;
    amount?: string | null;
    title?: string | null;
    note?: string | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from("transaction_templates")
    .update({
      name: params.name,
      wallet_id: params.walletId ?? null,
      pocket_id: params.pocketId ?? null,
      category_id: params.categoryId ?? null,
      amount: params.amount ?? null,
      title: params.title ?? null,
      note: params.note ?? null,
    })
    .eq("id", templateId);
  if (error) throw error;
}

export async function archiveTemplate(supabase: SupabaseClient<Database>, templateId: string): Promise<void> {
  const { error } = await supabase.from("transaction_templates").update({ archived_at: new Date().toISOString() }).eq("id", templateId);
  if (error) throw error;
}

export async function restoreTemplate(supabase: SupabaseClient<Database>, templateId: string): Promise<void> {
  const { error } = await supabase.from("transaction_templates").update({ archived_at: null }).eq("id", templateId);
  if (error) throw error;
}

export async function setTemplateTags(supabase: SupabaseClient<Database>, templateId: string, tagIds: string[]): Promise<void> {
  const { error } = await supabase.rpc("set_template_tags", { p_template_id: templateId, p_tag_ids: tagIds });
  if (error) throw error;
}
