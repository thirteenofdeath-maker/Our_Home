import { notFound } from "next/navigation";

import { listCategories } from "@/features/categories/api";
import { buildCategoryTree } from "@/features/categories/domain/tree";
import { listPocketsForWallet } from "@/features/pockets/api";
import type { Pocket } from "@/features/pockets/types";
import { EditRecurringForm } from "@/features/recurring/components/EditRecurringForm";
import { getRecurringTransaction } from "@/features/recurring/api";
import { listTags } from "@/features/tags/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function EditRecurringPage({
  params,
}: {
  params: Promise<{ recurringId: string }>;
}) {
  const { recurringId } = await params;
  const { supabase } = await requireUser();

  const rule = await getRecurringTransaction(supabase, recurringId);
  if (!rule) notFound();

  const [allWallets, categories, tags] = await Promise.all([
    listMyWallets(supabase),
    listCategories(supabase, { transactionType: rule.transactionType, scope: rule.scope }),
    listTags(supabase, { scope: rule.scope, householdId: rule.householdId }),
  ]);
  const wallets = allWallets.filter((w) => w.scope === rule.scope);

  const pocketsByWalletEntries = await Promise.all(wallets.map(async (w) => [w.id, await listPocketsForWallet(supabase, w.id)] as const));
  const pocketsByWallet: Record<string, Pocket[]> = Object.fromEntries(pocketsByWalletEntries);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">แก้ไขรายการประจำ</h1>
      <EditRecurringForm rule={rule} wallets={wallets} pocketsByWallet={pocketsByWallet} categories={buildCategoryTree(categories)} tags={tags} />
    </div>
  );
}
