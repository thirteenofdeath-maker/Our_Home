import { notFound, redirect } from "next/navigation";

import { buildCategoryTree } from "@/features/categories/domain/tree";
import { listCategoriesForWallet } from "@/features/categories/api";
import { listPocketsForWallet } from "@/features/pockets/api";
import { getAttributionForTransaction, getTransactionDetail } from "@/features/transactions/api";
import { EditAttributedHouseholdExpenseForm } from "@/features/transactions/components/EditAttributedHouseholdExpenseForm";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Phase U (0051): the ONLY edit route for a personal-funded household
 * expense. update_income_expense_transaction rejects these outright, so
 * this page + EditAttributedHouseholdExpenseForm + the dedicated
 * updateAttributedHouseholdExpenseAction is the sole write path — never a
 * fallback to the generic edit form/action, and never a direct table
 * mutation of household_expense_attributions (no client grant exists for
 * that table at all — see 0051).
 */
export default async function EditAttributedHouseholdExpensePage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;
  const { supabase } = await requireUser();

  const transaction = await getTransactionDetail(supabase, transactionId);
  if (!transaction) notFound();
  if (transaction.transactionType !== "EXPENSE" || !transaction.walletId || !transaction.pocketId) notFound();
  if (transaction.voidedAt) redirect(`/finance/transactions/${transactionId}`);

  const attribution = await getAttributionForTransaction(supabase, transactionId);
  // Not actually an attributed expense — route back to the ordinary edit
  // page rather than rendering a form for a household category that does
  // not exist for this transaction.
  if (!attribution) redirect(`/finance/transactions/${transactionId}/edit`);

  const [pockets, householdCategories] = await Promise.all([
    listPocketsForWallet(supabase, transaction.walletId),
    listCategoriesForWallet(supabase, {
      transactionType: "EXPENSE",
      wallet: { scope: "HOUSEHOLD", owner_user_id: null, household_id: attribution.householdId },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">แก้ไขรายจ่ายครอบครัว</h1>
      <EditAttributedHouseholdExpenseForm
        transaction={transaction}
        walletId={transaction.walletId}
        pockets={pockets}
        householdCategories={buildCategoryTree(householdCategories)}
        householdName={attribution.householdName}
        householdCategoryId={attribution.householdCategoryId}
        householdCategoryLabel={attribution.householdCategoryName}
      />
    </div>
  );
}
