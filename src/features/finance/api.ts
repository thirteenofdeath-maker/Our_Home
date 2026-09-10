import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { listAdjustmentInfoForTransactions } from "@/features/refunds/api";
import type { Database } from "@/types/database";

import {
  mapFinanceSummaryWire,
  mapRecentFinanceTransactions,
  type FinanceEntryRow,
  type FinanceSummaryWire,
  type FinanceTransactionRow,
} from "./domain/finance";
import type { FinanceRecentTransaction, FinanceSummary } from "./types";

export async function getFinanceSummary(
  supabase: SupabaseClient<Database>,
  range: { start: string; end: string },
): Promise<FinanceSummary> {
  const { data, error } = await supabase.rpc("get_finance_hub_summary", {
    p_month_start: range.start,
    p_month_end: range.end,
  });
  if (error) throw error;
  return mapFinanceSummaryWire((data ?? {}) as FinanceSummaryWire);
}

export async function listRecentFinanceTransactions(
  supabase: SupabaseClient<Database>,
  limit = 10,
): Promise<FinanceRecentTransaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, transaction_type, title, note, occurred_at, category:categories(name), creator:profiles!transactions_created_by_fkey(display_name)")
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const transactions = (data ?? []) as unknown as FinanceTransactionRow[];
  if (!transactions.length) return [];

  const { data: entriesData, error: entriesError } = await supabase
    .from("transaction_entries")
    .select("transaction_id, amount, wallet_id, wallet:wallets(name,currency), pocket:pockets(name)")
    .in(
      "transaction_id",
      transactions.map((item) => item.id),
    );
  if (entriesError) throw entriesError;

  const items = mapRecentFinanceTransactions(transactions, (entriesData ?? []) as unknown as FinanceEntryRow[]);

  // Batched — one lookup regardless of how many rows, same discipline as
  // every other adjustment annotation (docs/FINANCE.md Phase D).
  const adjustmentInfo = await listAdjustmentInfoForTransactions(
    supabase,
    items.map((item) => item.transactionId),
  );
  if (adjustmentInfo.size === 0) return items;
  return items.map((item) => {
    const match = adjustmentInfo.get(item.transactionId);
    return match ? { ...item, adjustment: { kind: match.kind, originalTitle: match.originalTitle } } : item;
  });
}
