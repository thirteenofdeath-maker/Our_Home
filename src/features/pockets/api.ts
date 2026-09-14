import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import { normalizeDatabaseMoney } from "@/lib/utils/money";

import type { Pocket, PocketWithBalance } from "./types";

export async function listPocketsForWallet(
  supabase: SupabaseClient<Database>,
  walletId: string,
): Promise<Pocket[]> {
  const { data, error } = await supabase
    .from("pockets")
    .select("*")
    .eq("wallet_id", walletId)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });

  if (error) logDatabaseErrorInDev("listPocketsForWallet failed", error);
  return data ?? [];
}

export async function listPocketsWithBalances(
  supabase: SupabaseClient<Database>,
  walletId: string,
): Promise<PocketWithBalance[]> {
  const pockets = await listPocketsForWallet(supabase, walletId);

  return Promise.all(
    pockets.map(async (pocket) => {
      const { data, error } = await supabase.rpc("get_pocket_balance", {
        p_pocket_id: pocket.id,
      });
      if (error) logDatabaseErrorInDev("getPocketBalance failed", error);
      return {
        ...pocket,
        balance: data === null ? "0.00" : normalizeDatabaseMoney(data),
      };
    }),
  );
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
