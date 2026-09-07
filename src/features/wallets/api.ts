import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

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

  if (error || !data) return [];
  return data;
}

export async function getWallet(supabase: SupabaseClient<Database>, walletId: string): Promise<Wallet | null> {
  const { data, error } = await supabase.from("wallets").select("*").eq("id", walletId).maybeSingle();
  if (error) return null;
  return data;
}

export async function getWalletBalance(supabase: SupabaseClient<Database>, walletId: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_wallet_balance", { p_wallet_id: walletId });
  if (error || data === null) return "0.00";
  return data;
}

export async function createWallet(
  supabase: SupabaseClient<Database>,
  params: {
    name: string;
    walletType: Database["public"]["Tables"]["wallets"]["Row"]["wallet_type"];
    currency: string;
    scope: "PERSONAL" | "HOUSEHOLD";
    ownerUserId: string | null;
    householdId: string | null;
    createdBy: string;
  },
): Promise<Wallet> {
  const { data, error } = await supabase
    .from("wallets")
    .insert({
      name: params.name,
      wallet_type: params.walletType,
      currency: params.currency,
      scope: params.scope,
      owner_user_id: params.ownerUserId,
      household_id: params.householdId,
      created_by: params.createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
