import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isNegative } from "@/lib/utils/money";
import type { Database } from "@/types/database";

import type { TransactionHistoryItem } from "./types";

export async function createIncomeExpense(
  supabase: SupabaseClient<Database>,
  params: {
    transactionType: "INCOME" | "EXPENSE";
    walletId: string;
    pocketId: string;
    categoryId: string;
    amount: string;
    title?: string | null;
    note?: string | null;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("create_income_expense_transaction", {
    p_transaction_type: params.transactionType,
    p_wallet_id: params.walletId,
    p_pocket_id: params.pocketId,
    p_category_id: params.categoryId,
    p_amount: params.amount,
    p_title: params.title ?? null,
    p_note: params.note ?? null,
  });

  if (error) throw error;
  return data;
}

export async function createPocketTransfer(
  supabase: SupabaseClient<Database>,
  params: {
    walletId: string;
    fromPocketId: string;
    toPocketId: string;
    amount: string;
    title?: string | null;
    note?: string | null;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("create_pocket_transfer", {
    p_wallet_id: params.walletId,
    p_from_pocket_id: params.fromPocketId,
    p_to_pocket_id: params.toPocketId,
    p_amount: params.amount,
    p_title: params.title ?? null,
    p_note: params.note ?? null,
  });

  if (error) throw error;
  return data;
}

export async function createWalletTransfer(
  supabase: SupabaseClient<Database>,
  params: {
    fromWalletId: string;
    fromPocketId: string;
    toWalletId: string;
    toPocketId: string;
    amount: string;
    title?: string | null;
    note?: string | null;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("create_wallet_transfer", {
    p_from_wallet_id: params.fromWalletId,
    p_from_pocket_id: params.fromPocketId,
    p_to_wallet_id: params.toWalletId,
    p_to_pocket_id: params.toPocketId,
    p_amount: params.amount,
    p_title: params.title ?? null,
    p_note: params.note ?? null,
  });

  if (error) throw error;
  return data;
}

interface RawHistoryRow {
  id: string;
  amount: string;
  pocket: { name: string } | null;
  transaction: {
    id: string;
    transaction_type: Database["public"]["Tables"]["transactions"]["Row"]["transaction_type"];
    title: string | null;
    note: string | null;
    occurred_at: string;
    deleted_at: string | null;
    category: { name: string } | null;
  } | null;
}

/**
 * The ledger stores one row per money movement (transaction_entries), so a
 * pocket transfer within this wallet naturally produces two rows sharing
 * one transaction_id. Presented as-is, that reads as two unrelated history
 * lines for what is, to the person looking at their wallet, one event —
 * see docs/DOMAIN_RULES.md "Pocket transfer" and Milestone 1 hardening
 * item 12. This groups entries by transaction_id and collapses a same-
 * wallet pair back into a single "Main → Travel" row. This is a
 * presentation/query fix only: the underlying ledger rows are untouched.
 *
 * Note: `limit` bounds the number of raw ledger rows fetched, not the
 * number of history rows returned (a pocket transfer collapses two rows
 * into one) — acceptable for Milestone 1's simple, unpaginated history
 * view; a transfer that happened to straddle the limit boundary would show
 * only its one fetched side until pagination is added.
 */
export async function listTransactionsForWallet(
  supabase: SupabaseClient<Database>,
  walletId: string,
  limit = 50,
): Promise<TransactionHistoryItem[]> {
  const { data, error } = await supabase
    .from("transaction_entries")
    .select(
      "id, amount, pocket:pockets(name), transaction:transactions(id, transaction_type, title, note, occurred_at, deleted_at, category:categories(name))",
    )
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const rows = (data as unknown as RawHistoryRow[]).filter(
    (row) => row.transaction && row.transaction.deleted_at === null,
  );

  const order: string[] = [];
  const groups = new Map<string, RawHistoryRow[]>();
  for (const row of rows) {
    const transactionId = row.transaction!.id;
    if (!groups.has(transactionId)) {
      groups.set(transactionId, []);
      order.push(transactionId);
    }
    groups.get(transactionId)!.push(row);
  }

  return order.map((transactionId) => {
    const entries = groups.get(transactionId)!;
    const t = entries[0].transaction!;

    if (entries.length === 2 && t.transaction_type === "TRANSFER") {
      const from = entries.find((e) => isNegative(e.amount)) ?? entries[0];
      const to = entries.find((e) => !isNegative(e.amount)) ?? entries[1];
      return {
        transactionId,
        transactionType: "TRANSFER",
        title: t.title,
        note: t.note,
        occurredAt: t.occurred_at,
        categoryName: null,
        amount: to.amount,
        pocketTransfer: {
          fromPocketName: from.pocket?.name ?? "?",
          toPocketName: to.pocket?.name ?? "?",
          amount: to.amount,
        },
      };
    }

    return {
      transactionId,
      transactionType: t.transaction_type,
      title: t.title,
      note: t.note,
      occurredAt: t.occurred_at,
      categoryName: t.category?.name ?? null,
      amount: entries[0].amount,
    };
  });
}
