"use server";

import { getMyPrimaryHousehold } from "@/features/household/api";
import {
  groupPocketsByWallet,
  listPocketsWithBalancesForWallets,
} from "@/features/pockets/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

/** Mirrors `src/app/(app)/finance/debts/new/page.tsx`'s exact fetch. */
export async function getDebtSheetData() {
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
