import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import { normalizeDatabaseMoney } from "@/lib/utils/money";

import type { Pocket, PocketWithBalance } from "./types";

export async function listPocketsForWallet(
  supabase: SupabaseClient<Database>,
  walletId: string,
  options: { includeArchived?: boolean } = {},
): Promise<Pocket[]> {
  return (await listPocketsForWallets(supabase, [walletId], options)).filter(
    (pocket) => pocket.wallet_id === walletId,
  );
}

export async function listPocketsForWallets(
  supabase: SupabaseClient<Database>,
  walletIds: string[],
  options: { includeArchived?: boolean } = {},
): Promise<Pocket[]> {
  if (walletIds.length === 0) return [];
  let query = supabase.from("pockets").select("*").in("wallet_id", walletIds);
  if (!options.includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query
    .order("wallet_id", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) logDatabaseErrorInDev("listPocketsForWallets failed", error);
  return data ?? [];
}

export async function listPocketsWithBalances(
  supabase: SupabaseClient<Database>,
  walletId: string,
  options: { includeArchived?: boolean } = {},
): Promise<PocketWithBalance[]> {
  return (
    await listPocketsWithBalancesForWallets(supabase, [walletId], options)
  ).filter((pocket) => pocket.wallet_id === walletId);
}

export async function listPocketsWithBalancesForWallets(
  supabase: SupabaseClient<Database>,
  walletIds: string[],
  options: { includeArchived?: boolean } = {},
): Promise<PocketWithBalance[]> {
  if (walletIds.length === 0) return [];
  const { data, error } = await supabase.rpc("list_pockets_with_balances", {
    p_wallet_ids: walletIds,
    p_include_archived: options.includeArchived ?? false,
  });
  if (error)
    logDatabaseErrorInDev("listPocketsWithBalancesForWallets failed", error);
  return (data ?? []).map((pocket) => ({
    ...pocket,
    balance: normalizeDatabaseMoney(pocket.balance),
  }));
}

export function groupPocketsByWallet<T extends Pocket>(
  walletIds: string[],
  pockets: T[],
): Record<string, T[]> {
  const grouped = Object.fromEntries(
    walletIds.map((walletId) => [walletId, [] as T[]]),
  );
  for (const pocket of pockets) grouped[pocket.wallet_id]?.push(pocket);
  return grouped;
}

export async function createPocket(
  supabase: SupabaseClient<Database>,
  params: { walletId: string; name: string; sortOrder?: number },
): Promise<Pocket> {
  const { data, error } = await supabase
    .from("pockets")
    .insert({
      wallet_id: params.walletId,
      name: params.name,
      sort_order: params.sortOrder ?? 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createPocketWithInitialBalance(
  supabase: SupabaseClient<Database>,
  params: {
    walletId: string;
    name: string;
    pocketType: Exclude<
      Database["public"]["Enums"]["wallet_type"],
      "CREDIT_CARD"
    >;
    currency: string;
    initialBalance: string;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc(
    "create_pocket_with_initial_balance",
    {
      p_wallet_id: params.walletId,
      p_name: params.name,
      p_pocket_type: params.pocketType,
      p_currency: params.currency,
      p_initial_balance: params.initialBalance,
    },
  );
  if (error) throw error;
  return data;
}

export async function createCreditCardPocket(
  supabase: SupabaseClient<Database>,
  params: {
    walletId: string;
    name: string;
    currency: string;
    creditLimit: string;
    availableCredit: string;
    statementClosingDay: number;
    paymentDueDay: number;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc(
    "create_credit_card_pocket_with_available_credit",
    {
      p_wallet_id: params.walletId,
      p_name: params.name,
      p_currency: params.currency,
      p_credit_limit: params.creditLimit,
      p_available_credit: params.availableCredit,
      p_statement_closing_day: params.statementClosingDay,
      p_payment_due_day: params.paymentDueDay,
    },
  );
  if (error) throw error;
  return data;
}

export async function listArchivedPocketsForWallet(
  supabase: SupabaseClient<Database>,
  walletId: string,
): Promise<Pocket[]> {
  const { data, error } = await supabase
    .from("pockets")
    .select("*")
    .eq("wallet_id", walletId)
    .eq("is_archived", true)
    .order("sort_order", { ascending: true });

  if (error)
    logDatabaseErrorInDev("listArchivedPocketsForWallet failed", error);
  return data ?? [];
}

export async function updatePocket(
  supabase: SupabaseClient<Database>,
  pocketId: string,
  walletId: string,
  params: {
    name: string;
    pocketType: Database["public"]["Enums"]["wallet_type"];
    targetBalance: string;
  },
): Promise<void> {
  const { error } = await supabase.rpc("update_pocket_details", {
    p_pocket_id: pocketId,
    p_wallet_id: walletId,
    p_name: params.name,
    p_pocket_type: params.pocketType,
    p_target_balance: params.targetBalance,
  });
  if (error) throw error;
}

/** Rejected by `pockets_require_active_sibling_to_archive` (0030) if this is the wallet's last active pocket. */
export async function archivePocket(
  supabase: SupabaseClient<Database>,
  pocketId: string,
): Promise<void> {
  const { error } = await supabase
    .from("pockets")
    .update({ is_archived: true })
    .eq("id", pocketId);
  if (error) throw error;
}

export async function restorePocket(
  supabase: SupabaseClient<Database>,
  pocketId: string,
): Promise<void> {
  const { error } = await supabase
    .from("pockets")
    .update({ is_archived: false })
    .eq("id", pocketId);
  if (error) throw error;
}

/** Rejected by `pockets_prevent_delete_if_used` (0030) if this pocket has ledger history or is the wallet's last pocket. */
export async function deletePocket(
  supabase: SupabaseClient<Database>,
  pocketId: string,
): Promise<void> {
  const { error } = await supabase.from("pockets").delete().eq("id", pocketId);
  if (error) throw error;
}
