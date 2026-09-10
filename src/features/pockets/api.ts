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
      const { data, error } = await supabase.rpc("get_pocket_balance", { p_pocket_id: pocket.id });
      if (error) logDatabaseErrorInDev("getPocketBalance failed", error);
      return { ...pocket, balance: data === null ? "0.00" : normalizeDatabaseMoney(data) };
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

  if (error) logDatabaseErrorInDev("listArchivedPocketsForWallet failed", error);
  return data ?? [];
}

export async function updatePocket(
  supabase: SupabaseClient<Database>,
  pocketId: string,
  params: { name?: string; icon?: string | null },
): Promise<void> {
  const { error } = await supabase.from("pockets").update({ name: params.name, icon: params.icon }).eq("id", pocketId);
  if (error) throw error;
}

/** Rejected by `pockets_require_active_sibling_to_archive` (0030) if this is the wallet's last active pocket. */
export async function archivePocket(supabase: SupabaseClient<Database>, pocketId: string): Promise<void> {
  const { error } = await supabase.from("pockets").update({ is_archived: true }).eq("id", pocketId);
  if (error) throw error;
}

export async function restorePocket(supabase: SupabaseClient<Database>, pocketId: string): Promise<void> {
  const { error } = await supabase.from("pockets").update({ is_archived: false }).eq("id", pocketId);
  if (error) throw error;
}

/** Rejected by `pockets_prevent_delete_if_used` (0030) if this pocket has ledger history or is the wallet's last pocket. */
export async function deletePocket(supabase: SupabaseClient<Database>, pocketId: string): Promise<void> {
  const { error } = await supabase.from("pockets").delete().eq("id", pocketId);
  if (error) throw error;
}
