"use server";

import { getMyPrimaryHousehold } from "@/features/household/api";
import {
  groupPocketsByWallet,
  listPocketsWithBalancesForWallets,
} from "@/features/pockets/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Mirrors `src/app/(app)/finance/goals/new/page.tsx`'s exact fetch — same
 * selectors, same shape — so the "Add Goal" form sheet needs no new
 * query. Only called when the sheet actually opens (JIT).
 */
export async function getGoalSheetData() {
  const { supabase, user } = await requireUser();
  const [household, wallets] = await Promise.all([
    getMyPrimaryHousehold(supabase, user.id),
    listMyWallets(supabase),
  ]);
  const walletIds = wallets.map((wallet) => wallet.id);
  const pockets = groupPocketsByWallet(
    walletIds,
    await listPocketsWithBalancesForWallets(supabase, walletIds),
  );
  return { wallets, pockets, hasHousehold: Boolean(household) };
}
