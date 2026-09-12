"use server";

import { listCategories } from "@/features/categories/api";
import { buildCategoryTree } from "@/features/categories/domain/tree";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";

/** Mirrors `src/app/(app)/finance/installments/new/page.tsx`'s exact fetch. */
export async function getInstallmentSheetData() {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const [personal, household_] = await Promise.all([
    listCategories(supabase, { scope: "PERSONAL", transactionType: "EXPENSE" }),
    household ? listCategories(supabase, { scope: "HOUSEHOLD", transactionType: "EXPENSE" }) : Promise.resolve([]),
  ]);
  return { personal: buildCategoryTree(personal), household: buildCategoryTree(household_), hasHousehold: Boolean(household) };
}
