import { notFound } from "next/navigation";
import { getBillOccurrence } from "@/features/bills/api";
import { PayBillForm } from "@/features/bills/components/PayBillForm";
import { listCategories } from "@/features/categories/api";
import { buildCategoryTree } from "@/features/categories/domain/tree";
import {
  groupPocketsByWallet,
  listPocketsWithBalancesForWallets,
} from "@/features/pockets/api";
import { listTags } from "@/features/tags/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";
export default async function PayPage({
  params,
}: {
  params: Promise<{ occurrenceId: string }>;
}) {
  const { occurrenceId } = await params;
  const { supabase } = await requireUser();
  const item = await getBillOccurrence(supabase, occurrenceId);
  if (!item || item.status !== "OPEN") notFound();
  const [wallets, categories, tags] = await Promise.all([
    listMyWallets(supabase),
    listCategories(supabase, { scope: item.scope, transactionType: "EXPENSE" }),
    listTags(supabase, { scope: item.scope, householdId: item.householdId }),
  ]);
  const eligible = wallets.filter(
    (w) => w.scope === item.scope && w.currency === item.currency,
  );
  const walletIds = eligible.map((wallet) => wallet.id);
  const pocketsByWallet = groupPocketsByWallet(
    walletIds,
    await listPocketsWithBalancesForWallets(supabase, walletIds),
  );
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">จ่ายบิล: {item.name}</h1>
      <PayBillForm
        item={item}
        wallets={eligible}
        pocketsByWallet={pocketsByWallet}
        categories={buildCategoryTree(categories)}
        tags={tags}
      />
    </div>
  );
}
