"use server";

import { listCategories } from "@/features/categories/api";
import { buildCategoryTree } from "@/features/categories/domain/tree";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listPocketsForWallet } from "@/features/pockets/api";
import type { Pocket } from "@/features/pockets/types";
import { listTags } from "@/features/tags/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

/** Mirrors `src/app/(app)/finance/recurring/new/page.tsx`'s exact fetch. */
export async function getRecurringSheetData() {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);

  const [allWallets, personalIncomeCategories, personalExpenseCategories, householdIncomeCategories, householdExpenseCategories, personalTags, householdTags] =
    await Promise.all([
      listMyWallets(supabase),
      listCategories(supabase, { transactionType: "INCOME", scope: "PERSONAL" }),
      listCategories(supabase, { transactionType: "EXPENSE", scope: "PERSONAL" }),
      household ? listCategories(supabase, { transactionType: "INCOME", scope: "HOUSEHOLD" }) : Promise.resolve([]),
      household ? listCategories(supabase, { transactionType: "EXPENSE", scope: "HOUSEHOLD" }) : Promise.resolve([]),
      listTags(supabase, { scope: "PERSONAL" }),
      household ? listTags(supabase, { scope: "HOUSEHOLD", householdId: household.id }) : Promise.resolve([]),
    ]);

  const personalWallets = allWallets.filter((w) => w.scope === "PERSONAL");
  const householdWallets = allWallets.filter((w) => w.scope === "HOUSEHOLD");
  const pocketsByWalletEntries = await Promise.all(allWallets.map(async (w) => [w.id, await listPocketsForWallet(supabase, w.id)] as const));
  const pocketsByWallet: Record<string, Pocket[]> = Object.fromEntries(pocketsByWalletEntries);

  return {
    hasHousehold: Boolean(household),
    personalWallets,
    householdWallets,
    pocketsByWallet,
    personalIncomeCategories: buildCategoryTree(personalIncomeCategories),
    personalExpenseCategories: buildCategoryTree(personalExpenseCategories),
    householdIncomeCategories: buildCategoryTree(householdIncomeCategories),
    householdExpenseCategories: buildCategoryTree(householdExpenseCategories),
    personalTags,
    householdTags,
  };
}
