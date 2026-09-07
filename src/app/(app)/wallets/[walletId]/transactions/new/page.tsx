import { notFound } from "next/navigation";

import { buildCategoryTree } from "@/features/categories/domain/tree";
import { listCategoriesForWallet } from "@/features/categories/api";
import { listPocketsForWallet } from "@/features/pockets/api";
import { TransactionForm } from "@/features/transactions/components/TransactionForm";
import { getWallet } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function NewTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ walletId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { walletId } = await params;
  const { type } = await searchParams;
  const transactionType = type === "EXPENSE" ? "EXPENSE" : "INCOME";

  const { supabase } = await requireUser();
  const wallet = await getWallet(supabase, walletId);
  if (!wallet) notFound();

  const [pockets, categories] = await Promise.all([
    listPocketsForWallet(supabase, walletId),
    listCategoriesForWallet(supabase, { transactionType, wallet }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{transactionType === "INCOME" ? "เพิ่มรายรับ" : "เพิ่มรายจ่าย"}</h1>
      <TransactionForm
        walletId={walletId}
        transactionType={transactionType}
        pockets={pockets}
        categories={buildCategoryTree(categories)}
      />
    </div>
  );
}
