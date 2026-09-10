import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonClassName } from "@/components/ui/Button";
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
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-foreground-muted">{wallet.name}</p>
        <p className="text-3xl font-semibold tabular-nums">{formatCurrency(balance, wallet.currency)}</p>
      </div>

      <WalletLifecycleControls wallet={wallet} />

      <div className="grid grid-cols-3 gap-2">
        <Link
          href={`/wallets/${walletId}/transactions/new?type=INCOME`}
          className={buttonClassName("secondary", "md", "px-2 text-income")}
        >
          + รายรับ
        </Link>
        <Link
          href={`/wallets/${walletId}/transactions/new?type=EXPENSE`}
          className={buttonClassName("secondary", "md", "px-2 text-expense")}
        >
          - รายจ่าย
        </Link>
        <Link href={`/wallets/${walletId}/transfer`} className={buttonClassName("secondary", "md", "px-2")}>
          โอนเงิน
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground-muted">ช่อง (Pockets)</h2>
        </div>
        <PocketManagerList walletId={wallet.id} pockets={pockets} archivedPockets={archivedPockets} currency={wallet.currency} />
        <PocketCreateLink walletId={wallet.id} />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground-muted">ประวัติล่าสุด</h2>
        </div>
        <TransactionHistoryList items={history} currency={wallet.currency} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground-muted">จัดการกระเป๋าเงิน</h2>
        <RenameWalletForm wallet={wallet} />
      </section>
    </div>
  );
}
