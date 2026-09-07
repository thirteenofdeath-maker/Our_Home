import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

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

  if (error || !data) return [];
  return data;
}

export async function listPocketsWithBalances(
  supabase: SupabaseClient<Database>,
  walletId: string,
): Promise<PocketWithBalance[]> {
  const pockets = await listPocketsForWallet(supabase, walletId);

  return Promise.all(
    pockets.map(async (pocket) => {
      const { data } = await supabase.rpc("get_pocket_balance", { p_pocket_id: pocket.id });
      return { ...pocket, balance: data ?? "0.00" };
    }),
  );
}

export async function createPocket(
  supabase: SupabaseClient<Database>,
  params: { walletId: string; name: string; sortOrder?: number },
): Promise<Pocket> {
  const { data, error } = await supabase
    .from("pockets")
    .insert({ wallet_id: params.walletId, name: params.name, sort_order: params.sortOrder ?? 0 })
    .select()
    .single();

  if (error) throw error;
  return data;
}
