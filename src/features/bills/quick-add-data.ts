"use server";

import { listCategories } from "@/features/categories/api";
import { buildCategoryTree } from "@/features/categories/domain/tree";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listPocketsForWallet } from "@/features/pockets/api";
import type { Pocket } from "@/features/pockets/types";
import { listTags } from "@/features/tags/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

/** Mirrors `src/app/(app)/finance/bills/new/page.tsx`'s exact fetch. */
export async function getBillSheetData() {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const [wallets, personalCategories, householdCategories, personalTags, householdTags] = await Promise.all([
    listMyWallets(supabase),
    listCategories(supabase, { scope: "PERSONAL", transactionType: "EXPENSE" }),
    household ? listCategories(supabase, { scope: "HOUSEHOLD", transactionType: "EXPENSE" }) : Promise.resolve([]),
    listTags(supabase, { scope: "PERSONAL" }),
    household ? listTags(supabase, { scope: "HOUSEHOLD", householdId: household.id }) : Promise.resolve([]),
  ]);
  const pocketsByWallet: Record<string, Pocket[]> = Object.fromEntries(
    await Promise.all(wallets.map(async (w) => [w.id, await listPocketsForWallet(supabase, w.id)] as const)),
  );
  return {
    wallets,
    pocketsByWallet,
    categories: { PERSONAL: buildCategoryTree(personalCategories), HOUSEHOLD: buildCategoryTree(householdCategories) },
    tags: { PERSONAL: personalTags, HOUSEHOLD: householdTags },
    hasHousehold: Boolean(household),
  };
}
