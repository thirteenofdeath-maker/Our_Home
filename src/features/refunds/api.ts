import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import { normalizeDatabaseMoney } from "@/lib/utils/money";
import type { Database } from "@/types/database";

import type { AdjustmentOrigin, AdjustmentSummaryItem, ExpenseAdjustmentKind, RefundableSummary } from "./types";

export async function createExpenseAdjustment(
  supabase: SupabaseClient<Database>,
  params: {
    originalExpenseId: string;
    adjustmentKind: ExpenseAdjustmentKind;
    walletId: string;
    pocketId: string;
    amount: string;
    title?: string | null;
    note?: string | null;
    occurredAt?: string;
    tagIds?: string[];
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("create_expense_adjustment_transaction", {
    p_original_expense_id: params.originalExpenseId,
    p_adjustment_kind: params.adjustmentKind,
    p_wallet_id: params.walletId,
    p_pocket_id: params.pocketId,
    p_amount: params.amount,
    p_title: params.title ?? null,
    p_note: params.note ?? null,
    p_occurred_at: params.occurredAt,
    p_tag_ids: params.tagIds?.length ? params.tagIds : null,
  });
  if (error) throw error;
  return data;
}

interface RefundableSummaryWire {
  original_amount?: string | number;
  active_refund_total?: string | number;
  active_reimbursement_total?: string | number;
  remaining_adjustable_amount?: string | number;
}

/** "How much of this Expense is still refundable/reimbursable" — the same figure the create RPC enforces, never client-subtracted. */
export async function getRefundableSummary(
  supabase: SupabaseClient<Database>,
  originalExpenseTransactionId: string,
): Promise<RefundableSummary | null> {
  const { data, error } = await supabase.rpc("get_expense_refundable_summary", { p_transaction_id: originalExpenseTransactionId });
  if (error) {
    logDatabaseErrorInDev("getRefundableSummary failed", error);
    return null;
  }
  const wire = (data ?? {}) as RefundableSummaryWire;
  if (wire.original_amount === undefined) return null;
  return {
    originalAmount: normalizeDatabaseMoney(wire.original_amount),
    activeRefundTotal: normalizeDatabaseMoney(wire.active_refund_total ?? 0),
    activeReimbursementTotal: normalizeDatabaseMoney(wire.active_reimbursement_total ?? 0),
    remainingAdjustableAmount: normalizeDatabaseMoney(wire.remaining_adjustable_amount ?? 0),
  };
}

interface RawAdjustmentRow {
  transaction_id: string;
  adjustment_kind: ExpenseAdjustmentKind;
  transaction: {
    deleted_at: string | null;
    occurred_at: string;
  } | null;
}

interface RawAdjustmentEntryRow {
  transaction_id: string;
  amount: string | number;
  wallet: { name: string } | null;
  pocket: { name: string } | null;
}

/**
 * Every refund/reimbursement transaction linked against one original
 * Expense — for its "คืนแล้ว" list. `expense_adjustments` has no direct
 * foreign key into `transaction_entries` (both merely reference
 * `transactions` independently), so this is two bounded queries — the
 * link rows, then their entries by transaction_id — merged in JS, the
 * same two-query-merge shape already used by
 * listRecentFinanceTransactions. Not a per-row query: exactly two calls
 * regardless of how many adjustments exist.
 */
export async function listAdjustmentsForOriginal(
  supabase: SupabaseClient<Database>,
  originalExpenseTransactionId: string,
): Promise<AdjustmentSummaryItem[]> {
  const { data, error } = await supabase
    .from("expense_adjustments")
    .select("transaction_id, adjustment_kind, transaction:transactions!expense_adjustments_transaction_id_fkey(deleted_at, occurred_at)")
    .eq("original_expense_transaction_id", originalExpenseTransactionId)
    .order("created_at", { ascending: false });

  if (error) {
    logDatabaseErrorInDev("listAdjustmentsForOriginal failed", error);
    return [];
  }

  const links = ((data ?? []) as unknown as RawAdjustmentRow[]).filter((row) => row.transaction);
  if (links.length === 0) return [];

  const { data: entriesData, error: entriesError } = await supabase
    .from("transaction_entries")
    .select("transaction_id, amount, wallet:wallets(name), pocket:pockets(name)")
    .in(
      "transaction_id",
      links.map((row) => row.transaction_id),
    );

  if (entriesError) {
    logDatabaseErrorInDev("listAdjustmentsForOriginal entries failed", entriesError);
    return [];
  }

  const entryByTransactionId = new Map((entriesData as unknown as RawAdjustmentEntryRow[]).map((e) => [e.transaction_id, e]));

  return links
    .map((row) => {
      const entry = entryByTransactionId.get(row.transaction_id);
      if (!entry) return null;
      return {
        transactionId: row.transaction_id,
        kind: row.adjustment_kind,
        amount: normalizeDatabaseMoney(entry.amount),
        occurredAt: row.transaction!.occurred_at,
        walletName: entry.wallet?.name ?? "?",
        pocketName: entry.pocket?.name ?? "?",
        voidedAt: row.transaction!.deleted_at,
      };
    })
    .filter((item): item is AdjustmentSummaryItem => item !== null);
}

interface RawAdjustmentOriginRow {
  adjustment_kind: ExpenseAdjustmentKind;
  original_expense_transaction_id: string;
  original: { title: string | null; category: { name: string } | null } | null;
}

/** "Is this transaction ITSELF a refund/reimbursement, and if so what does it adjust" — for its own detail view. */
export async function getAdjustmentOrigin(supabase: SupabaseClient<Database>, transactionId: string): Promise<AdjustmentOrigin | null> {
  const { data, error } = await supabase
    .from("expense_adjustments")
    .select(
      "adjustment_kind, original_expense_transaction_id, original:transactions!expense_adjustments_original_expense_transaction_id_fkey(title, category:categories(name))",
    )
    .eq("transaction_id", transactionId)
    .maybeSingle();

  if (error) {
    logDatabaseErrorInDev("getAdjustmentOrigin failed", error);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as RawAdjustmentOriginRow;
  return {
    kind: row.adjustment_kind,
    originalTransactionId: row.original_expense_transaction_id,
    originalTitle: row.original?.title ?? null,
    originalCategoryName: row.original?.category?.name ?? null,
  };
}

export interface AdjustmentInfo {
  kind: ExpenseAdjustmentKind;
  originalTransactionId: string;
  originalTitle: string | null;
}

interface RawAdjustmentInfoRow {
  transaction_id: string;
  adjustment_kind: ExpenseAdjustmentKind;
  original_expense_transaction_id: string;
  original: { title: string | null } | null;
}

/**
 * Batched — one query for however many transaction ids are passed, never
 * one query per transaction (same discipline as tags/listTagsForTransactions).
 * Used to annotate history/search rows with "คืนเงิน · <original title>".
 */
export async function listAdjustmentInfoForTransactions(
  supabase: SupabaseClient<Database>,
  transactionIds: string[],
): Promise<Map<string, AdjustmentInfo>> {
  const result = new Map<string, AdjustmentInfo>();
  if (transactionIds.length === 0) return result;

  const { data, error } = await supabase
    .from("expense_adjustments")
    .select("transaction_id, adjustment_kind, original_expense_transaction_id, original:transactions!expense_adjustments_original_expense_transaction_id_fkey(title)")
    .in("transaction_id", transactionIds);

  if (error) {
    logDatabaseErrorInDev("listAdjustmentInfoForTransactions failed", error);
    return result;
  }

  for (const row of (data ?? []) as unknown as RawAdjustmentInfoRow[]) {
    result.set(row.transaction_id, {
      kind: row.adjustment_kind,
      originalTransactionId: row.original_expense_transaction_id,
      originalTitle: row.original?.title ?? null,
    });
  }
  return result;
}

/**
 * Every transaction id currently marked as a refund/reimbursement (RLS-
 * scoped), optionally narrowed to one kind — used by searchTransactions'
 * type filter (EXPENSE excludes these ids; REFUND/REIMBURSEMENT includes
 * only the matching-kind ids). Bounded the same way tag/category lookups
 * already are in this app (no pagination in V1).
 */
export async function listAdjustmentTransactionIds(supabase: SupabaseClient<Database>, kind?: ExpenseAdjustmentKind): Promise<string[]> {
  let query = supabase.from("expense_adjustments").select("transaction_id");
  if (kind) query = query.eq("adjustment_kind", kind);

  const { data, error } = await query;
  if (error) {
    logDatabaseErrorInDev("listAdjustmentTransactionIds failed", error);
    return [];
  }
  return (data ?? []).map((row) => row.transaction_id);
}
