import { notFound } from "next/navigation";

import { listCategories } from "@/features/categories/api";
import { buildCategoryTree } from "@/features/categories/domain/tree";
import { EditTemplateForm } from "@/features/templates/components/EditTemplateForm";
import { getTemplate } from "@/features/templates/api";
import { listPocketsForWallet } from "@/features/pockets/api";
import type { Pocket } from "@/features/pockets/types";
import { listTags } from "@/features/tags/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const { supabase } = await requireUser();

  const template = await getTemplate(supabase, templateId);
  if (!template) notFound();

  const [allWallets, categories, tags] = await Promise.all([
    listMyWallets(supabase),
    listCategories(supabase, { transactionType: template.transactionType, scope: template.scope }),
    listTags(supabase, { scope: template.scope, householdId: template.householdId }),
  ]);
  const wallets = allWallets.filter((w) => w.scope === template.scope);

  const pocketsByWalletEntries = await Promise.all(wallets.map(async (w) => [w.id, await listPocketsForWallet(supabase, w.id)] as const));
  const pocketsByWallet: Record<string, Pocket[]> = Object.fromEntries(pocketsByWalletEntries);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">แก้ไข Template</h1>
      <EditTemplateForm template={template} wallets={wallets} pocketsByWallet={pocketsByWallet} categories={buildCategoryTree(categories)} tags={tags} />
    </div>
  );
}
