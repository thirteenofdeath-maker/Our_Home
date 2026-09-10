import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonClassName } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { buildCategoryTree } from "@/features/categories/domain/tree";
import { listCategoriesForWallet } from "@/features/categories/api";
import { listPocketsForWallet } from "@/features/pockets/api";
import { getAdjustmentOrigin } from "@/features/refunds/api";
import { listTags, listTagsForTransaction } from "@/features/tags/api";
import { getTransactionDetail } from "@/features/transactions/api";
import { EditTransactionForm } from "@/features/transactions/components/EditTransactionForm";
import { getWallet } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;
  const { supabase } = await requireUser();

  const transaction = await getTransactionDetail(supabase, transactionId);
  if (!transaction) notFound();
  // Transfers are immutable in this phase (see docs/FINANCE.md Phase B).
  if (transaction.transactionType === "TRANSFER" || transaction.transactionType === "DEBT_PRINCIPAL" || !transaction.walletId) notFound();
  // A refund/reimbursement is immutable in Phase D V1 — void it and
  // create a corrected one instead (see docs/FINANCE.md Phase D).
  if (await getAdjustmentOrigin(supabase, transactionId)) notFound();

  if (transaction.voidedAt) {
    return (
      <EmptyState
        title="รายการนี้ถูกยกเลิกแล้ว"
        description="กู้คืนรายการก่อนจึงจะแก้ไขได้"
        action={
          <Link href={`/finance/transactions/${transactionId}`} className={buttonClassName("secondary", "md")}>
            กลับไปหน้ารายการ
          </Link>
        }
      />
    );
  }

  const wallet = await getWallet(supabase, transaction.walletId);
  if (!wallet) notFound();

  const [pockets, categories, tags, currentTags] = await Promise.all([
    listPocketsForWallet(supabase, transaction.walletId),
    listCategoriesForWallet(supabase, { transactionType: transaction.transactionType, wallet }),
    listTags(supabase, { scope: wallet.scope, householdId: wallet.household_id }),
    listTagsForTransaction(supabase, transactionId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{transaction.transactionType === "INCOME" ? "แก้ไขรายรับ" : "แก้ไขรายจ่าย"}</h1>
      <EditTransactionForm
        transaction={{ ...transaction, transactionType: transaction.transactionType }}
        walletId={transaction.walletId}
        pockets={pockets}
        categories={buildCategoryTree(categories)}
        tags={tags}
        currentTags={currentTags}
      />
    </div>
  );
}
