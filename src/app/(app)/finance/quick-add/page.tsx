import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { FinanceCreatePageFlow } from "@/features/finance/components/FinanceCreatePageFlow";
import { getIncomeExpenseSheetData } from "@/features/finance/quick-add-data";
import { getWallet } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function Page({ searchParams }: { searchParams: Promise<{ walletId?: string }> }) {
  const query = await searchParams;
  const { supabase } = await requireUser();
  if (!query.walletId) notFound();
  const wallet = await getWallet(supabase, query.walletId);
  if (!wallet || wallet.is_archived) notFound();
  const initialData = await getIncomeExpenseSheetData(wallet.id, "EXPENSE");
  return (
    <div className="finance-scope -mx-4 flex flex-col gap-4 px-4 pb-8">
      <PageHeader title="เพิ่มรายการ" backHref="/finance" />
      <p className="-mt-3 text-sm text-finance-muted">{wallet.name} · {wallet.currency} · {wallet.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}</p>
      <FinanceCreatePageFlow walletId={wallet.id} initialData={initialData} />
    </div>
  );
}
