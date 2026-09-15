"use server";

import { getMyPrimaryHousehold } from "@/features/household/api";
import { listPocketsWithBalances } from "@/features/pockets/api";
import type { PocketWithBalance } from "@/features/pockets/types";
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
  const pairs = await Promise.all(
    wallets.map(
      async (w) =>
        [w.id, await listPocketsWithBalances(supabase, w.id)] as const,
    ),
  );
  const pockets: Record<string, PocketWithBalance[]> =
    Object.fromEntries(pairs);
  return { wallets, pockets, hasHousehold: Boolean(household) };
}
