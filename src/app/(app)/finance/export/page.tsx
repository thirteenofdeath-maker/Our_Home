import { listCategories } from "@/features/categories/api";
import { FinanceExportForm } from "@/features/exports/FinanceExportForm";
import { listPocketsForWallet } from "@/features/pockets/api";
import { listTags } from "@/features/tags/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function ExportPage() {
  const { supabase } = await requireUser();
  const wallets = await listMyWallets(supabase);
  const [pocketGroups, incomeCategories, expenseCategories, personalTags, householdTags] =
    await Promise.all([
      Promise.all(
        wallets.map(async (wallet) => ({
          wallet,
          pockets: await listPocketsForWallet(supabase, wallet.id),
        })),
      ),
      listCategories(supabase, { transactionType: "INCOME" }),
      listCategories(supabase, { transactionType: "EXPENSE" }),
      listTags(supabase, { scope: "PERSONAL" }),
      listTags(supabase, { scope: "HOUSEHOLD" }),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">ส่งออกข้อมูลการเงิน</h1>
      <FinanceExportForm
        wallets={wallets.map((wallet) => ({
          id: wallet.id,
          label: wallet.name,
          description: wallet.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว",
        }))}
        pockets={pocketGroups.flatMap(({ wallet, pockets }) =>
          pockets.map((pocket) => ({
            id: pocket.id,
            walletId: wallet.id,
            label: pocket.name,
            description: `${wallet.name} · ${pocket.currency}`,
          })),
        )}
        categories={[
          ...incomeCategories.map((category) => ({
            id: category.id,
            label: category.name,
            description: "รายรับ",
          })),
          ...expenseCategories.map((category) => ({
            id: category.id,
            label: category.name,
            description: "รายจ่าย",
          })),
        ]}
        tags={[
          ...personalTags.map((tag) => ({
            id: tag.id,
            label: `#${tag.name}`,
            description: "ส่วนตัว",
          })),
          ...householdTags.map((tag) => ({
            id: tag.id,
            label: `#${tag.name}`,
            description: "ครอบครัว",
          })),
        ]}
      />
    </div>
  );
}
