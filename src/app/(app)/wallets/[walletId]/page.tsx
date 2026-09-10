import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { listArchivedPocketsForWallet, listPocketsWithBalances } from "@/features/pockets/api";
import { PocketCreateLink } from "@/features/pockets/components/PocketCreateLink";
import { PocketManagerList } from "@/features/pockets/components/PocketManagerList";
import { listTransactionsForWallet } from "@/features/transactions/api";
import { getWallet, getWalletBalance } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency } from "@/lib/utils/money";

import { TransactionHistoryList } from "@/features/transactions/components/TransactionHistoryList";

export default async function WalletDetailPage({
  params,
}: {
  params: Promise<{ walletId: string }>;
}) {
  const { walletId } = await params;
  const { supabase } = await requireUser();

  const wallet = await getWallet(supabase, walletId);
  if (!wallet) notFound();

  const [balance, pockets, archivedPockets, history] = await Promise.all([
    getWalletBalance(supabase, walletId),
    listPocketsWithBalances(supabase, walletId),
    listArchivedPocketsForWallet(supabase, walletId),
    listTransactionsForWallet(supabase, walletId, 20),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader
        title={wallet.name}
        fallbackHref="/finance"
        rightAction={<Link href={`/wallets/${walletId}/manage`} aria-label="จัดการกระเป๋าเงิน" className="flex size-11 items-center justify-center rounded-full hover:bg-primary-soft"><AppIcon name="more" /></Link>}
      />

      <div className="flex flex-col items-center gap-2 py-3 text-center">
        <div aria-hidden="true" className="flex size-13 items-center justify-center rounded-full bg-surface text-primary shadow-sm"><AppIcon name="wallet" /></div>
        <p className="text-3xl font-semibold tabular-nums">{formatCurrency(balance, wallet.currency)}</p>
        <p className="text-sm text-foreground-muted">{wallet.currency} · {wallet.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}</p>
      </div>

      <div className="grid grid-cols-3 gap-2" aria-label="รายการด่วน">
        <Link
          href={`/wallets/${walletId}/transactions/new?type=INCOME`}
          className="flex min-h-22 flex-col items-center justify-center gap-2 rounded-card bg-surface shadow-card text-sm font-medium"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-income/15 text-income"><AppIcon name="income" /></span>รายรับ
        </Link>
        <Link
          href={`/wallets/${walletId}/transactions/new?type=EXPENSE`}
          className="flex min-h-22 flex-col items-center justify-center gap-2 rounded-card bg-surface shadow-card text-sm font-medium"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-expense/15 text-expense"><AppIcon name="expense" /></span>รายจ่าย
        </Link>
        <Link href={`/wallets/${walletId}/transfer`} className="flex min-h-22 flex-col items-center justify-center gap-2 rounded-card bg-surface shadow-card text-sm font-medium">
          <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-transfer"><AppIcon name="transfer" /></span>โอนเงิน
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">ช่อง (Pockets)</h2>
          <PocketCreateLink walletId={wallet.id} />
        </div>
        <PocketManagerList compact walletId={wallet.id} pockets={pockets} archivedPockets={archivedPockets} currency={wallet.currency} />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground-muted">ประวัติล่าสุด</h2>
        </div>
        <TransactionHistoryList items={history} currency={wallet.currency} />
      </section>

    </div>
  );
}
