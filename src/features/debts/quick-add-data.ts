"use server";

import { getMyPrimaryHousehold } from "@/features/household/api";
import { listPocketsForWallet } from "@/features/pockets/api";
import type { Pocket } from "@/features/pockets/types";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

/** Mirrors `src/app/(app)/finance/debts/new/page.tsx`'s exact fetch. */
export async function getDebtSheetData() {
  const { supabase, user } = await requireUser();
  const [household, wallets] = await Promise.all([getMyPrimaryHousehold(supabase, user.id), listMyWallets(supabase)]);
  const pockets: Record<string, Pocket[]> = Object.fromEntries(
    await Promise.all(wallets.map(async (w) => [w.id, await listPocketsForWallet(supabase, w.id)] as const)),
  );
  return { wallets, pockets, hasHousehold: Boolean(household) };
}
