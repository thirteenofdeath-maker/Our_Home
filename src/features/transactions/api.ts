import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

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
  transaction: {
    id: string;
    transaction_type: Database["public"]["Tables"]["transactions"]["Row"]["transaction_type"];
    title: string | null;
    note: string | null;
    occurred_at: string;
    category: { name: string } | null;
  } | null;
}

export async function listTransactionsForWallet(
  supabase: SupabaseClient<Database>,
  walletId: string,
  limit = 50,
): Promise<TransactionHistoryItem[]> {
  const { data, error } = await supabase
    .from("transaction_entries")
    .select(
      "id, amount, transaction:transactions(id, transaction_type, title, note, occurred_at, deleted_at, category:categories(name))",
    )
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as unknown as (RawHistoryRow & { transaction: RawHistoryRow["transaction"] & { deleted_at: string | null } })[])
    .filter((row) => row.transaction && row.transaction.deleted_at === null)
    .map((row) => ({
      entryId: row.id,
      amount: row.amount,
      transactionId: row.transaction!.id,
      transactionType: row.transaction!.transaction_type,
      title: row.transaction!.title,
      note: row.transaction!.note,
      occurredAt: row.transaction!.occurred_at,
      categoryName: row.transaction!.category?.name ?? null,
    }));
}
