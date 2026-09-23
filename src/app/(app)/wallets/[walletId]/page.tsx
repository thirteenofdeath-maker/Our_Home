import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import {
  listArchivedPocketsForWallet,
  listPocketsWithBalances,
} from "@/features/pockets/api";
import { PocketCreateLink } from "@/features/pockets/components/PocketCreateLink";
import { PocketManagerList } from "@/features/pockets/components/PocketManagerList";
import { listTransactionsForWallet } from "@/features/transactions/api";
import { getWallet } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency, sumMoney } from "@/lib/utils/money";

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

  const [pockets, archivedPockets, history] = await Promise.all([
    listPocketsWithBalances(supabase, walletId),
    listArchivedPocketsForWallet(supabase, walletId),
    listTransactionsForWallet(supabase, walletId, 20),
  ]);
  const balances = [...new Set(pockets.map((pocket) => pocket.currency))].map(
    (currency) => ({
      currency,
      amount: sumMoney(
        pockets
          .filter((pocket) => pocket.currency === currency)
          .map((pocket) => pocket.balance),
      ),
    }),
  );

  return (
    <div className="finance-scope -mx-4 flex flex-col gap-6 px-4 pb-8 pt-2">
      <PageHeader
        title={wallet.name}
        backHref="/wallets"
        rightAction={
          <Link
            href={`/wallets/${walletId}/manage`}
            aria-label="จัดการกระเป๋าเงิน"
            className="flex size-11 items-center justify-center rounded-full hover:bg-finance-primary-soft"
          >
            <AppIcon name="more" />
          </Link>
        }
      />

      <div className="relative overflow-hidden rounded-[1.5rem] bg-finance-primary p-6 text-center text-finance-primary-foreground shadow-[0_1px_2px_rgb(68_80_92_/_0.04),0_8px_20px_rgb(68_80_92_/_0.1)]">
        <div
          aria-hidden="true"
          className="absolute -right-6 -top-6 flex size-28 items-center justify-center rounded-full bg-white/10"
        >
          <AppIcon
            name="wallet"
            className="size-14 text-finance-primary-foreground/40"
          />
        </div>
        <div className="relative z-[1] flex flex-col gap-1">
          {balances.length ? (
            balances.map((balance) => (
              <p
                key={balance.currency}
                className="text-3xl font-semibold tabular-nums"
              >
                {formatCurrency(balance.amount, balance.currency)}
              </p>
            ))
          ) : (
            <p className="text-3xl font-semibold">฿0.00</p>
          )}
        </div>
        <p className="relative z-[1] mt-1 text-sm text-finance-primary-foreground/80">
          {wallet.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"} ·{" "}
          {pockets.length} Pocket
        </p>
      </div>

      {/*
        PROCESS_ENTRY_INLINE (intentional exception): รายรับ/รายจ่าย/โอนเงิน
        are genuine process entries, but this always-visible 3-tile "รายการ
        ด่วน" cluster IS the process launcher itself, in the same way the
        Finance dashboard's own quick-add tiles work — the tiles are the
        compact trigger, not a full-page distraction, and every tile is
        exactly one tap from its real destination already. Hiding them
        behind an extra "+" -> slide-up-sheet tap would ADD friction to an
        already-minimal launcher, which is the specific anti-pattern this
        audit calls out (don't wrap an already-visible quick-action grid
        in a sheet). Left as direct <Link>s, not menu items in a sheet.
      */}
      <div className="grid grid-cols-3 gap-2" aria-label="รายการด่วน">
        <Link
          href={`/wallets/${walletId}/transactions/new?type=INCOME`}
          className="flex min-h-22 flex-col items-center justify-center gap-2 rounded-[1.25rem] bg-finance-surface-strong text-sm font-medium text-finance-text shadow-sm"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-finance-income/15 text-finance-income">
            <AppIcon name="income" />
          </span>
          รายรับ
        </Link>
        <Link
          href={`/wallets/${walletId}/transactions/new?type=EXPENSE`}
          className="flex min-h-22 flex-col items-center justify-center gap-2 rounded-[1.25rem] bg-finance-surface-strong text-sm font-medium text-finance-text shadow-sm"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-finance-expense/15 text-finance-expense">
            <AppIcon name="expense" />
          </span>
          รายจ่าย
        </Link>
        <Link
          href={`/wallets/${walletId}/transfer`}
          className="flex min-h-22 flex-col items-center justify-center gap-2 rounded-[1.25rem] bg-finance-surface-strong text-sm font-medium text-finance-text shadow-sm"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-finance-transfer/15 text-finance-transfer">
            <AppIcon name="transfer" />
          </span>
          โอนเงิน
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-finance-text">ช่อง (Pockets)</h2>
          <PocketCreateLink walletId={wallet.id} />
        </div>
        <PocketManagerList
          compact
          walletId={wallet.id}
          pockets={pockets}
          archivedPockets={archivedPockets}
        />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-finance-muted">
            ประวัติล่าสุด
          </h2>
        </div>
        <TransactionHistoryList items={history} variant="wallet" />
      </section>
    </div>
  );
}
