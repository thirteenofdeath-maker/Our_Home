import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { listAdjustmentInfoForTransactions, listAdjustmentTransactionIds } from "@/features/refunds/api";
import { isNegative, normalizeDatabaseMoney } from "@/lib/utils/money";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import type { Database } from "@/types/database";

import type { TransactionHistoryItem } from "./types";

/**
 * One batched lookup (never one query per row — see
 * listAdjustmentInfoForTransactions) merged onto already-grouped history
 * items, so a refund/reimbursement row renders "คืนเงิน · <original
 * title>" instead of a plain "รายจ่าย" label (docs/FINANCE.md Phase D).
 */
async function withAdjustmentInfo(
  supabase: SupabaseClient<Database>,
  items: TransactionHistoryItem[],
): Promise<TransactionHistoryItem[]> {
  if (items.length === 0) return items;
  const info = await listAdjustmentInfoForTransactions(
    supabase,
    items.map((item) => item.transactionId),
  );
  if (info.size === 0) return items;
  return items.map((item) => {
    const match = info.get(item.transactionId);
    return match ? { ...item, adjustment: { kind: match.kind, originalTitle: match.originalTitle } } : item;
  });
}

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
    occurredAt?: string;
    tagIds?: string[];
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
    p_occurred_at: params.occurredAt,
    p_tag_ids: params.tagIds?.length ? params.tagIds : null,
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
    occurredAt?: string;
    tagIds?: string[];
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("create_pocket_transfer", {
    p_wallet_id: params.walletId,
    p_from_pocket_id: params.fromPocketId,
    p_to_pocket_id: params.toPocketId,
    p_amount: params.amount,
    p_title: params.title ?? null,
    p_note: params.note ?? null,
    p_occurred_at: params.occurredAt,
    p_tag_ids: params.tagIds?.length ? params.tagIds : null,
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
    occurredAt?: string;
    tagIds?: string[];
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
    p_occurred_at: params.occurredAt,
    p_tag_ids: params.tagIds?.length ? params.tagIds : null,
  });

  if (error) throw error;
  return data;
}

export interface RawHistoryRow {
  id: string;
  amount: string | number;
  wallet_id: string;
  wallet: { name: string; currency?: string } | null;
  pocket: { name: string } | null;
  transaction: {
    id: string;
    transaction_type: Database["public"]["Tables"]["transactions"]["Row"]["transaction_type"];
    title: string | null;
    note: string | null;
    occurred_at: string;
    deleted_at: string | null;
    category: { name: string } | null;
    creator: { display_name: string } | null;
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
 * `limit` bounds initial wallet-entry candidates. A second query fetches
 * both sides of every transfer candidate, so a limit boundary cannot split
 * one logical transfer. Pagination remains future work.
 */
export async function listTransactionsForWallet(
  supabase: SupabaseClient<Database>,
  walletId: string,
  limit = 50,
): Promise<TransactionHistoryItem[]> {
  const select =
    "id, amount, wallet_id, wallet:wallets(name), pocket:pockets(name), transaction:transactions(id, transaction_type, title, note, occurred_at, deleted_at, category:categories(name), creator:profiles!transactions_created_by_fkey(display_name))";
  const { data, error } = await supabase
    .from("transaction_entries")
    .select(select)
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logDatabaseErrorInDev("listTransactionsForWallet failed", error);
    return [];
  }
  if (!data) return [];

  const rows = (data as unknown as RawHistoryRow[]).filter(
    (row) => row.transaction && row.transaction.deleted_at === null,
  );

  const transferIds = [...new Set(rows.filter((row) => row.transaction?.transaction_type === "TRANSFER").map((row) => row.transaction!.id))];
  let expandedRows = rows;
  if (transferIds.length > 0) {
    const { data: transferData, error: transferError } = await supabase
      .from("transaction_entries")
      .select(select)
      .in("transaction_id", transferIds);
    if (transferError) logDatabaseErrorInDev("listTransactionsForWallet transfer expansion failed", transferError);
    if (transferData) {
      const nonTransferRows = rows.filter((row) => row.transaction?.transaction_type !== "TRANSFER");
      expandedRows = [...nonTransferRows, ...(transferData as unknown as RawHistoryRow[])];
    }
  }

  return withAdjustmentInfo(supabase, groupHistoryRows(rows, expandedRows, walletId));
}

export function groupHistoryRows(
  visibleRows: RawHistoryRow[],
  expandedRows: RawHistoryRow[],
  walletId: string,
): TransactionHistoryItem[] {
  const order: string[] = [];
  const groups = new Map<string, RawHistoryRow[]>();
  for (const row of visibleRows) {
    const transactionId = row.transaction!.id;
    if (!order.includes(transactionId)) order.push(transactionId);
  }
  for (const row of expandedRows) {
    if (!row.transaction || row.transaction.deleted_at !== null) continue;
    const transactionId = row.transaction.id;
    if (!groups.has(transactionId)) groups.set(transactionId, []);
    groups.get(transactionId)!.push(row);
  }

  return order.map<TransactionHistoryItem>((transactionId) => {
    const entries = groups.get(transactionId)!;
    const t = entries[0].transaction!;

    const viewedEntry = entries.find((entry) => entry.wallet_id === walletId) ?? entries[0];

    if (entries.length === 2 && t.transaction_type === "TRANSFER") {
      const from = entries.find((e) => isNegative(normalizeDatabaseMoney(e.amount))) ?? entries[0];
      const to = entries.find((e) => !isNegative(normalizeDatabaseMoney(e.amount))) ?? entries[1];
      const toAmount = normalizeDatabaseMoney(to.amount);
      const viewedAmount = normalizeDatabaseMoney(viewedEntry.amount);
      return {
        transactionId,
        transactionType: "TRANSFER",
        title: t.title,
        note: t.note,
        occurredAt: t.occurred_at,
        categoryName: null,
        walletName: viewedEntry.wallet?.name ?? "?",
        pocketName: viewedEntry.pocket?.name ?? "?",
        creatorName: t.creator?.display_name ?? null,
        voidedAt: t.deleted_at,
        amount: from.wallet_id === to.wallet_id ? toAmount : viewedAmount,
        ...(from.wallet_id === to.wallet_id
          ? { pocketTransfer: { fromPocketName: from.pocket?.name ?? "?", toPocketName: to.pocket?.name ?? "?", amount: toAmount } }
          : { walletTransfer: {
              fromWalletName: from.wallet?.name ?? "?",
              fromPocketName: from.pocket?.name ?? "?",
              toWalletName: to.wallet?.name ?? "?",
              toPocketName: to.pocket?.name ?? "?",
            } }),
      };
    }

    return {
      transactionId,
      transactionType: t.transaction_type,
      title: t.title,
      note: t.note,
      occurredAt: t.occurred_at,
      categoryName: t.category?.name ?? null,
      walletName: viewedEntry.wallet?.name ?? "?",
      pocketName: viewedEntry.pocket?.name ?? "?",
      creatorName: t.creator?.display_name ?? null,
      voidedAt: t.deleted_at,
      amount: normalizeDatabaseMoney(viewedEntry.amount),
    };
  }).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

// ---------------------------------------------------------------------
// Phase B: edit / void / restore (INCOME/EXPENSE only — see
// docs/FINANCE.md Phase B). All three go through SECURITY DEFINER RPCs
// (0031); there is no direct table UPDATE grant on transactions or
// transaction_entries, same as every other ledger write in this app.
// ---------------------------------------------------------------------

export async function updateIncomeExpense(
  supabase: SupabaseClient<Database>,
  params: {
    transactionId: string;
    pocketId: string;
    categoryId: string;
    amount: string;
    title?: string | null;
    note?: string | null;
    occurredAt?: string;
    /** Full replacement tag set. Omit to leave tags unchanged; pass [] to clear all. */
    tagIds?: string[];
  },
): Promise<void> {
  const { error } = await supabase.rpc("update_income_expense_transaction", {
    p_transaction_id: params.transactionId,
    p_pocket_id: params.pocketId,
    p_category_id: params.categoryId,
    p_amount: params.amount,
    p_title: params.title ?? null,
    p_note: params.note ?? null,
    p_occurred_at: params.occurredAt,
    p_tag_ids: params.tagIds ?? null,
  });
  if (error) throw error;
}

export async function voidTransaction(
  supabase: SupabaseClient<Database>,
  transactionId: string,
  voidReason?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("void_transaction", {
    p_transaction_id: transactionId,
    p_void_reason: voidReason ?? null,
  });
  if (error) throw error;
}

export async function restoreTransaction(supabase: SupabaseClient<Database>, transactionId: string): Promise<void> {
  const { error } = await supabase.rpc("restore_transaction", { p_transaction_id: transactionId });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Transaction detail
// ---------------------------------------------------------------------

export interface TransactionDetail {
  transactionId: string;
  transactionType: Database["public"]["Tables"]["transactions"]["Row"]["transaction_type"];
  title: string | null;
  note: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  voidedByName: string | null;
  creatorName: string | null;
  /** INCOME/EXPENSE only — null for TRANSFER. */
  categoryId: string | null;
  categoryName: string | null;
  /** INCOME/EXPENSE only — the transaction's single wallet/pocket/amount/currency. */
  walletId: string | null;
  walletName: string | null;
  pocketId: string | null;
  pocketName: string | null;
  currency: string | null;
  amount: string | null;
  pocketTransfer?: { fromPocketName: string; toPocketName: string; amount: string };
  walletTransfer?: {
    fromWalletName: string;
    fromPocketName: string;
    toWalletName: string;
    toPocketName: string;
    amount: string;
    currency: string;
  };
}

interface RawDetailTransaction {
  id: string;
  transaction_type: Database["public"]["Tables"]["transactions"]["Row"]["transaction_type"];
  title: string | null;
  note: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  void_reason: string | null;
  category_id: string | null;
  category: { name: string } | null;
  creator: { display_name: string } | null;
  voider: { display_name: string } | null;
}

interface RawDetailEntry {
  amount: string | number;
  wallet_id: string;
  pocket_id: string;
  wallet: { name: string; currency: string } | null;
  pocket: { name: string } | null;
}

/**
 * Fetches everything /finance/transactions/[transactionId] needs in two
 * bounded queries (header + its entries) — RLS on `transactions` already
 * restricts this to a row the caller may see, so a nonexistent id and an
 * inaccessible id are indistinguishable (null), same as `getWallet`.
 */
export async function getTransactionDetail(
  supabase: SupabaseClient<Database>,
  transactionId: string,
): Promise<TransactionDetail | null> {
  const { data: transaction, error } = await supabase
    .from("transactions")
    .select(
      "id, transaction_type, title, note, occurred_at, created_at, updated_at, deleted_at, void_reason, category_id, category:categories(name), creator:profiles!transactions_created_by_fkey(display_name), voider:profiles!transactions_voided_by_fkey(display_name)",
    )
    .eq("id", transactionId)
    .maybeSingle();

  if (error) {
    logDatabaseErrorInDev("getTransactionDetail failed", error);
    return null;
  }
  if (!transaction) return null;

  const t = transaction as unknown as RawDetailTransaction;

  const { data: entriesData, error: entriesError } = await supabase
    .from("transaction_entries")
    .select("amount, wallet_id, pocket_id, wallet:wallets(name, currency), pocket:pockets(name)")
    .eq("transaction_id", transactionId);

  if (entriesError) {
    logDatabaseErrorInDev("getTransactionDetail entries failed", entriesError);
    return null;
  }

  const entries = (entriesData ?? []) as unknown as RawDetailEntry[];

  const base = {
    transactionId: t.id,
    transactionType: t.transaction_type,
    title: t.title,
    note: t.note,
    occurredAt: t.occurred_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    voidedAt: t.deleted_at,
    voidReason: t.void_reason,
    voidedByName: t.voider?.display_name ?? null,
    creatorName: t.creator?.display_name ?? null,
  };

  if (t.transaction_type === "TRANSFER" && entries.length === 2) {
    const from = entries.find((e) => isNegative(normalizeDatabaseMoney(e.amount))) ?? entries[0];
    const to = entries.find((e) => !isNegative(normalizeDatabaseMoney(e.amount))) ?? entries[1];
    const toAmount = normalizeDatabaseMoney(to.amount);
    const isPocketTransfer = from.wallet_id === to.wallet_id;
    return {
      ...base,
      categoryId: null,
      categoryName: null,
      walletId: null,
      walletName: null,
      pocketId: null,
      pocketName: null,
      currency: null,
      amount: null,
      ...(isPocketTransfer
        ? { pocketTransfer: { fromPocketName: from.pocket?.name ?? "?", toPocketName: to.pocket?.name ?? "?", amount: toAmount } }
        : {
            walletTransfer: {
              fromWalletName: from.wallet?.name ?? "?",
              fromPocketName: from.pocket?.name ?? "?",
              toWalletName: to.wallet?.name ?? "?",
              toPocketName: to.pocket?.name ?? "?",
              amount: toAmount,
              currency: to.wallet?.currency ?? from.wallet?.currency ?? "THB",
            },
          }),
    };
  }

  const entry = entries[0];
  return {
    ...base,
    categoryId: t.category_id,
    categoryName: t.category?.name ?? null,
    walletId: entry?.wallet_id ?? null,
    walletName: entry?.wallet?.name ?? null,
    pocketId: entry?.pocket_id ?? null,
    pocketName: entry?.pocket?.name ?? null,
    currency: entry?.wallet?.currency ?? null,
    amount: entry ? normalizeDatabaseMoney(entry.amount) : null,
  };
}

// ---------------------------------------------------------------------
// Search / filter (/finance/transactions). Same "group ledger entries by
// transaction_id, expand transfer candidates to both sides" strategy as
// listTransactionsForWallet, but not scoped to one wallet and without the
// active-only assumption — status is one of the filters here, not a given.
// Filtering happens entirely in the query (server/repository side, never
// client-side); the transfer-expansion step re-fetches only the bounded
// set of transfer transaction_ids that already matched every other
// filter, so it cannot turn into an N+1.
// ---------------------------------------------------------------------

export interface TransactionSearchFilters {
  dateFrom?: string;
  dateTo?: string;
  type?: "ALL" | "INCOME" | "EXPENSE" | "REFUND" | "REIMBURSEMENT" | "POCKET_TRANSFER" | "WALLET_TRANSFER";
  walletId?: string;
  pocketId?: string;
  categoryId?: string;
  /** Single tag filter (V1 — see docs/FINANCE.md Phase C "History search"). */
  tagId?: string;
  status?: "ACTIVE" | "VOIDED" | "ALL";
  query?: string;
  limit?: number;
}

const SEARCH_SELECT =
  "id, amount, wallet_id, wallet:wallets(name, currency), pocket:pockets(name), transaction:transactions!inner(id, transaction_type, title, note, occurred_at, deleted_at, category_id, category:categories(name), creator:profiles!transactions_created_by_fkey(display_name))";

export async function searchTransactions(
  supabase: SupabaseClient<Database>,
  filters: TransactionSearchFilters = {},
): Promise<TransactionHistoryItem[]> {
  const limit = filters.limit ?? 100;
  // REFUND/REIMBURSEMENT are stored as transaction_type = 'EXPENSE' at the
  // DB level (see docs/FINANCE.md Phase D) — same "one DB type, split by a
  // small lookup" pattern already used for POCKET_TRANSFER/WALLET_TRANSFER
  // under 'TRANSFER'. The EXPENSE/REFUND/REIMBURSEMENT split itself is
  // applied after the query, once adjustment ids are known (below).
  const dbType =
    filters.type === "POCKET_TRANSFER" || filters.type === "WALLET_TRANSFER"
      ? "TRANSFER"
      : filters.type === "REFUND" || filters.type === "REIMBURSEMENT"
        ? "EXPENSE"
        : filters.type;

  let query = supabase.from("transaction_entries").select(SEARCH_SELECT);

  if (filters.walletId) query = query.eq("wallet_id", filters.walletId);
  if (filters.pocketId) query = query.eq("pocket_id", filters.pocketId);
  if (dbType && dbType !== "ALL") query = query.eq("transaction.transaction_type", dbType);
  if (filters.categoryId) query = query.eq("transaction.category_id", filters.categoryId);
  if (filters.dateFrom) query = query.gte("transaction.occurred_at", filters.dateFrom);
  if (filters.dateTo) query = query.lt("transaction.occurred_at", filters.dateTo);
  if (filters.status === "ACTIVE") query = query.is("transaction.deleted_at", null);
  else if (filters.status === "VOIDED") query = query.not("transaction.deleted_at", "is", null);
  if (filters.query?.trim()) {
    const escaped = filters.query.trim().replace(/[%_]/g, (c) => `\\${c}`);
    query = query.or(`title.ilike.%${escaped}%,note.ilike.%${escaped}%`, { referencedTable: "transaction" });
  }

  if (filters.tagId) {
    // A bounded lookup, not per-row filtering: one query for the set of
    // transaction ids carrying this tag, then narrow the entries query by
    // it. Both of a transfer's entries share transaction_id, so a tagged
    // transfer's pair still passes together — grouping below still
    // collapses it to one logical row (docs/FINANCE.md Phase C).
    const { data: taggedRows, error: tagError } = await supabase.from("transaction_tags").select("transaction_id").eq("tag_id", filters.tagId);
    if (tagError) {
      logDatabaseErrorInDev("searchTransactions tag lookup failed", tagError);
      return [];
    }
    const taggedTransactionIds = [...new Set((taggedRows ?? []).map((row) => row.transaction_id))];
    if (taggedTransactionIds.length === 0) return [];
    query = query.in("transaction_id", taggedTransactionIds);
  }

  if (filters.type === "REFUND" || filters.type === "REIMBURSEMENT") {
    const adjustmentIds = await listAdjustmentTransactionIds(supabase, filters.type);
    if (adjustmentIds.length === 0) return [];
    query = query.in("transaction_id", adjustmentIds);
  } else if (filters.type === "EXPENSE") {
    // Plain EXPENSE excludes refund/reimbursement rows — those have their
    // own filter options above, mirroring how neither shows under a bare
    // "TRANSFER" option either.
    const adjustmentIds = await listAdjustmentTransactionIds(supabase);
    if (adjustmentIds.length > 0) query = query.notIn("transaction_id", adjustmentIds);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) {
    logDatabaseErrorInDev("searchTransactions failed", error);
    return [];
  }
  if (!data) return [];

  const rows = (data as unknown as RawHistoryRow[]).filter((row) => row.transaction);

  const transferIds = [...new Set(rows.filter((row) => row.transaction?.transaction_type === "TRANSFER").map((row) => row.transaction!.id))];
  let expandedRows = rows;
  if (transferIds.length > 0) {
    const { data: transferData, error: transferError } = await supabase
      .from("transaction_entries")
      .select(SEARCH_SELECT)
      .in("transaction_id", transferIds);
    if (transferError) logDatabaseErrorInDev("searchTransactions transfer expansion failed", transferError);
    if (transferData) {
      const nonTransferRows = rows.filter((row) => row.transaction?.transaction_type !== "TRANSFER");
      expandedRows = [...nonTransferRows, ...(transferData as unknown as RawHistoryRow[])];
    }
  }

  let items = groupSearchRows(rows, expandedRows);

  if (filters.type === "POCKET_TRANSFER") items = items.filter((item) => item.pocketTransfer);
  if (filters.type === "WALLET_TRANSFER") items = items.filter((item) => item.walletTransfer);

  return withAdjustmentInfo(supabase, items);
}

/**
 * Like groupHistoryRows, but with no single "wallet being viewed" to frame
 * a transfer against (search results span every wallet the caller can
 * see) and without hard-excluding voided transactions (status is a query
 * filter here, not a given — see searchTransactions above). Every row
 * carries its own `currency`, since — unlike a single wallet's history —
 * results here are not implicitly all the same currency.
 */
export function groupSearchRows(visibleRows: RawHistoryRow[], expandedRows: RawHistoryRow[]): TransactionHistoryItem[] {
  const order: string[] = [];
  const groups = new Map<string, RawHistoryRow[]>();
  for (const row of visibleRows) {
    const transactionId = row.transaction!.id;
    if (!order.includes(transactionId)) order.push(transactionId);
  }
  for (const row of expandedRows) {
    if (!row.transaction) continue;
    const transactionId = row.transaction.id;
    if (!groups.has(transactionId)) groups.set(transactionId, []);
    groups.get(transactionId)!.push(row);
  }

  return order
    .map<TransactionHistoryItem>((transactionId) => {
      const entries = groups.get(transactionId)!;
      const t = entries[0].transaction!;
      const primary = entries[0];

      if (entries.length === 2 && t.transaction_type === "TRANSFER") {
        const from = entries.find((e) => isNegative(normalizeDatabaseMoney(e.amount))) ?? entries[0];
        const to = entries.find((e) => !isNegative(normalizeDatabaseMoney(e.amount))) ?? entries[1];
        const toAmount = normalizeDatabaseMoney(to.amount);
        return {
          transactionId,
          transactionType: "TRANSFER",
          title: t.title,
          note: t.note,
          occurredAt: t.occurred_at,
          categoryName: null,
          walletName: from.wallet?.name ?? "?",
          pocketName: from.pocket?.name ?? "?",
          creatorName: t.creator?.display_name ?? null,
          voidedAt: t.deleted_at,
          currency: to.wallet?.currency ?? from.wallet?.currency ?? "THB",
          amount: toAmount,
          ...(from.wallet_id === to.wallet_id
            ? { pocketTransfer: { fromPocketName: from.pocket?.name ?? "?", toPocketName: to.pocket?.name ?? "?", amount: toAmount } }
            : {
                walletTransfer: {
                  fromWalletName: from.wallet?.name ?? "?",
                  fromPocketName: from.pocket?.name ?? "?",
                  toWalletName: to.wallet?.name ?? "?",
                  toPocketName: to.pocket?.name ?? "?",
                },
              }),
        };
      }

      return {
        transactionId,
        transactionType: t.transaction_type,
        title: t.title,
        note: t.note,
        occurredAt: t.occurred_at,
        categoryName: t.category?.name ?? null,
        walletName: primary.wallet?.name ?? "?",
        pocketName: primary.pocket?.name ?? "?",
        creatorName: t.creator?.display_name ?? null,
        voidedAt: t.deleted_at,
        currency: primary.wallet?.currency ?? "THB",
        amount: normalizeDatabaseMoney(primary.amount),
      };
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
