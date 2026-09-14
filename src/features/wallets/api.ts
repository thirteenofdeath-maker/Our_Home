import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { logDatabaseErrorInDev } from "@/lib/supabase/log-error";
import { normalizeDatabaseMoney } from "@/lib/utils/money";

import type { Wallet } from "./types";

/**
 * No explicit owner/household filtering here: RLS on `wallets` already
 * restricts every one of these queries to rows the caller may see (their
 * own PERSONAL wallets, plus HOUSEHOLD wallets for households they belong
 * to). Listing "my wallets" is simply "list wallets".
 */
export async function listMyWallets(supabase: SupabaseClient<Database>): Promise<Wallet[]> {
  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  if (error) logDatabaseErrorInDev("listMyWallets failed", error);
  return data ?? [];
}

export async function getWallet(supabase: SupabaseClient<Database>, walletId: string): Promise<Wallet | null> {
  const { data, error } = await supabase.from("wallets").select("*").eq("id", walletId).maybeSingle();
  if (error) {
    logDatabaseErrorInDev("getWallet failed", error);
    return null;
  }
  return data;
}

export async function getWalletBalance(supabase: SupabaseClient<Database>, walletId: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_wallet_balance", { p_wallet_id: walletId });
  if (error) logDatabaseErrorInDev("getWalletBalance failed", error);
  if (error || data === null) return "0.00";
  return normalizeDatabaseMoney(data);
}

export async function listArchivedWallets(supabase: SupabaseClient<Database>): Promise<Wallet[]> {
  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("is_archived", true)
    .order("created_at", { ascending: true });

  if (error) logDatabaseErrorInDev("listArchivedWallets failed", error);
  return data ?? [];
}

/**
 * Creates a wallet and its first pocket atomically (0029:
 * create_wallet_with_first_pocket) — a wallet can never end up with zero
 * pockets, and there is no "Main"/default pocket concept: the caller
 * names this pocket like any other. `created_by` is not a parameter; the
 * RPC derives it from `auth.uid()` itself, same as every other write path
 * in this schema.
 */
export async function createWallet(
  supabase: SupabaseClient<Database>,
  params: {
    name: string;
    walletType: Database["public"]["Tables"]["wallets"]["Row"]["wallet_type"];
    currency: string;
    scope: "PERSONAL" | "HOUSEHOLD";
    ownerUserId: string | null;
    householdId: string | null;
    firstPocketName: string;
  },
): Promise<Wallet> {
  const { data, error } = await supabase.rpc("create_wallet_with_first_pocket", {
    p_scope: params.scope,
    p_owner_user_id: params.ownerUserId,
    p_household_id: params.householdId,
    p_name: params.name,
    p_wallet_type: params.walletType,
    p_currency: params.currency,
    p_first_pocket_name: params.firstPocketName,
  });

  if (error) throw error;
  return data;
}

/**
 * `currency` is only accepted here — it is up to the database
 * (`wallets_before_update_currency_history_guard`, 0030) to reject it if
 * this wallet already has ledger history; the repository does not
 * duplicate that check.
 */
export async function updateWallet(
  supabase: SupabaseClient<Database>,
  walletId: string,
  params: { name?: string; walletType?: Database["public"]["Tables"]["wallets"]["Row"]["wallet_type"]; icon?: string | null; currency?: string },
): Promise<void> {
  const { error } = await supabase
    .from("wallets")
    .update({ name: params.name, wallet_type: params.walletType, icon: params.icon, currency: params.currency })
    .eq("id", walletId);
  if (error) throw error;
}

/** Rejected by `wallets_before_update_archive_zero_balance` (0030) unless the wallet's derived balance is exactly zero. */
export async function archiveWallet(supabase: SupabaseClient<Database>, walletId: string): Promise<void> {
  const { error } = await supabase.from("wallets").update({ is_archived: true }).eq("id", walletId);
  if (error) throw error;
}

export async function restoreWallet(supabase: SupabaseClient<Database>, walletId: string): Promise<void> {
  const { error } = await supabase.from("wallets").update({ is_archived: false }).eq("id", walletId);
  if (error) throw error;
}

/** Rejected by `wallets_prevent_delete_if_used` (0030) if the wallet has any transaction history. */
export async function deleteWallet(supabase: SupabaseClient<Database>, walletId: string): Promise<void> {
  const { error } = await supabase.from("wallets").delete().eq("id", walletId);
  if (error) throw error;
}
