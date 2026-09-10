import { listCategories } from "@/features/categories/api";
import { buildCategoryTree } from "@/features/categories/domain/tree";
import { CreateTemplateForm } from "@/features/templates/components/CreateTemplateForm";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listPocketsForWallet } from "@/features/pockets/api";
import type { Pocket } from "@/features/pockets/types";
import { listTagsForTransaction } from "@/features/tags/api";
import { listTags } from "@/features/tags/api";
import { getTransactionDetail } from "@/features/transactions/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function NewTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ fromTransactionId?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const { fromTransactionId } = await searchParams;
  const household = await getMyPrimaryHousehold(supabase, user.id);

  // "สร้าง Template จากรายการนี้" (docs/FINANCE.md Phase F "Quick save")
  // — only the allowed defaults are copied, never occurred_at/created_at/
  // void state/adjustment relationships, none of which apply to a
  // Template. Silently ignored if the transaction isn't a plain,
  // authorized INCOME/EXPENSE (RLS-invisible, a TRANSFER, or itself a
  // Refund/Reimbursement) — the form just opens blank instead.
  const sourceTransaction = fromTransactionId ? await getTransactionDetail(supabase, fromTransactionId) : null;
  const isEligibleSource = sourceTransaction && (sourceTransaction.transactionType === "INCOME" || sourceTransaction.transactionType === "EXPENSE");
  const sourceTags = isEligibleSource ? await listTagsForTransaction(supabase, fromTransactionId!) : [];

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

  const sourceWallet = isEligibleSource ? allWallets.find((w) => w.id === sourceTransaction!.walletId) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">สร้าง Template</h1>
      <CreateTemplateForm
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
        initialScope={sourceWallet?.scope}
        initialTransactionType={isEligibleSource ? (sourceTransaction!.transactionType as "INCOME" | "EXPENSE") : undefined}
        initialName={isEligibleSource ? sourceTransaction!.title ?? sourceTransaction!.categoryName ?? undefined : undefined}
        initialWalletId={sourceWallet?.id}
        initialPocketId={isEligibleSource ? sourceTransaction!.pocketId ?? undefined : undefined}
        initialCategoryId={isEligibleSource && !sourceTransaction!.voidedAt ? sourceTransaction!.categoryId ?? undefined : undefined}
        initialAmount={isEligibleSource ? sourceTransaction!.amount?.replace(/^-/, "") ?? undefined : undefined}
        initialTitle={isEligibleSource ? sourceTransaction!.title ?? undefined : undefined}
        initialNote={isEligibleSource ? sourceTransaction!.note ?? undefined : undefined}
        initialTagIds={isEligibleSource ? sourceTags : undefined}
      />
    </div>
  );
}
