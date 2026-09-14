"use server";

import { listCategories } from "@/features/categories/api";
import { buildCategoryTree } from "@/features/categories/domain/tree";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Mirrors `src/app/(app)/finance/budgets/new/page.tsx`'s exact fetch —
 * same selectors, same shape — so the "Add Budget" form sheet needs no
 * new query. Only called when the sheet actually opens (JIT), never on
 * every /finance/budgets page load.
 */
export async function getBudgetSheetData() {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const [personalCategories, householdCategories] = await Promise.all([
    listCategories(supabase, { transactionType: "EXPENSE", scope: "PERSONAL" }),
    household ? listCategories(supabase, { transactionType: "EXPENSE", scope: "HOUSEHOLD" }) : Promise.resolve([]),
  ]);
  return {
    hasHousehold: Boolean(household),
    personalCategories: buildCategoryTree(personalCategories),
    householdCategories: buildCategoryTree(householdCategories),
  };
}
