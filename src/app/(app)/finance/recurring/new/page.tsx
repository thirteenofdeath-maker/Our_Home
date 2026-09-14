import { listCategories } from "@/features/categories/api";
import { buildCategoryTree } from "@/features/categories/domain/tree";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listPocketsForWallet } from "@/features/pockets/api";
import type { Pocket } from "@/features/pockets/types";
import { CreateRecurringForm } from "@/features/recurring/components/CreateRecurringForm";
import { listTags } from "@/features/tags/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function NewRecurringPage() {
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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">เพิ่มรายการประจำ</h1>
      <CreateRecurringForm
        hasHousehold={Boolean(household)}
        personalWallets={personalWallets}
        householdWallets={householdWallets}
        pocketsByWallet={pocketsByWallet}
        personalIncomeCategories={buildCategoryTree(personalIncomeCategories)}
        personalExpenseCategories={buildCategoryTree(personalExpenseCategories)}
        householdIncomeCategories={buildCategoryTree(householdIncomeCategories)}
        householdExpenseCategories={buildCategoryTree(householdExpenseCategories)}
        personalTags={personalTags}
        householdTags={householdTags}
      />
    </div>
  );
}
