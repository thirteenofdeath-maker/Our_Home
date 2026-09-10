import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { listArchivedPocketsForWallet, listPocketsWithBalances } from "@/features/pockets/api";
import { PocketCreateLink } from "@/features/pockets/components/PocketCreateLink";
import { PocketManagerList } from "@/features/pockets/components/PocketManagerList";
import { listTransactionsForWallet } from "@/features/transactions/api";
import { getWallet, getWalletBalance } from "@/features/wallets/api";
import { RenameWalletForm } from "@/features/wallets/components/RenameWalletForm";
import { WalletLifecycleControls } from "@/features/wallets/components/WalletLifecycleControls";
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
        rightAction={<a href="#wallet-management" aria-label="จัดการกระเป๋าเงิน" className="flex size-11 items-center justify-center rounded-full text-2xl hover:bg-surface-muted">⋯</a>}
      />

      <div className="flex flex-col items-center gap-2 rounded-card bg-primary/10 p-5 text-center">
        <div aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">{wallet.name.trim().charAt(0) || "W"}</div>
        <p className="font-medium">{wallet.name}</p>
        <p className="text-3xl font-semibold tabular-nums">{formatCurrency(balance, wallet.currency)}</p>
      </div>

      <div className="grid grid-cols-3 gap-2" aria-label="รายการด่วน">
        <Link
          href={`/wallets/${walletId}/transactions/new?type=INCOME`}
          className="flex min-h-12 items-center justify-center rounded-control border border-income/20 bg-income/10 px-2 text-sm font-medium text-income"
        >
          + รายรับ
        </Link>
        <Link
          href={`/wallets/${walletId}/transactions/new?type=EXPENSE`}
          className="flex min-h-12 items-center justify-center rounded-control border border-expense/20 bg-expense/10 px-2 text-sm font-medium text-expense"
        >
          - รายจ่าย
        </Link>
        <Link href={`/wallets/${walletId}/transfer`} className="flex min-h-12 items-center justify-center rounded-control border border-transfer/20 bg-transfer/10 px-2 text-sm font-medium text-transfer">
          โอนเงิน
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">ช่อง (Pockets)</h2>
          <PocketCreateLink walletId={wallet.id} />
        </div>
        <PocketManagerList walletId={wallet.id} pockets={pockets} archivedPockets={archivedPockets} currency={wallet.currency} />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground-muted">ประวัติล่าสุด</h2>
        </div>
        <TransactionHistoryList items={history} currency={wallet.currency} />
      </section>

      <section id="wallet-management" className="flex flex-col gap-2 scroll-mt-4">
        <h2 className="text-sm font-medium text-foreground-muted">จัดการกระเป๋าเงิน</h2>
        <RenameWalletForm wallet={wallet} />
        <WalletLifecycleControls wallet={wallet} />
      </section>
    </div>
  );
}
