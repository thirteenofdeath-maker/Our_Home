import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { getWalletBalance, listArchivedWallets, listMyWallets } from "@/features/wallets/api";
import { WalletVisualCard } from "@/features/wallets/components/WalletVisualCard";
import { requireUser } from "@/lib/auth/require-user";

export default async function WalletsPage() {
  const { supabase } = await requireUser();
  const [wallets, archivedWallets] = await Promise.all([listMyWallets(supabase), listArchivedWallets(supabase)]);

  const withBalance = await Promise.all(
    wallets.map(async (wallet) => ({ wallet, balance: await getWalletBalance(supabase, wallet.id) })),
  );

  const personal = withBalance.filter((w) => w.wallet.scope === "PERSONAL");
  const household = withBalance.filter((w) => w.wallet.scope === "HOUSEHOLD");

  return (
    <div className="finance-scope -mx-4 flex w-full flex-col gap-6 px-4 pb-8 pt-2">
      <PageHeader
        title="กระเป๋าเงิน"
        fallbackHref="/finance"
        rightAction={<Link href="/wallets/new" aria-label="เพิ่มกระเป๋าเงิน" className="flex size-11 items-center justify-center rounded-full text-finance-primary-strong hover:bg-finance-primary-soft"><AppIcon name="plus" /></Link>}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-finance-muted">ส่วนตัว</h2>
        {personal.length === 0 ? (
          <EmptyState title="ยังไม่มีกระเป๋าเงินส่วนตัว" description="เพิ่มบัญชีธนาคารหรือเงินสดของคุณ" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {personal.map(({ wallet, balance }, index) => (
              <WalletVisualCard key={wallet.id} id={wallet.id} name={wallet.name} currency={wallet.currency} scopeLabel="ส่วนตัว" balance={balance} index={index} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-finance-muted">ครอบครัว</h2>
        {household.length === 0 ? (
          <EmptyState title="ยังไม่มีกระเป๋าเงินครอบครัว" description="สร้างครอบครัวก่อนเพื่อเพิ่มกระเป๋าเงินร่วมกัน" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {household.map(({ wallet, balance }, index) => (
              <WalletVisualCard key={wallet.id} id={wallet.id} name={wallet.name} currency={wallet.currency} scopeLabel="ครอบครัว" balance={balance} index={index} />
            ))}
          </div>
        )}
      </section>

      {archivedWallets.length > 0 ? (
        <details className="rounded-[1.25rem] bg-finance-surface-strong px-4 py-2 shadow-sm">
          <summary className="cursor-pointer text-sm text-finance-muted">กระเป๋าเงินที่เก็บถาวร ({archivedWallets.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {archivedWallets.map((wallet) => (
              <li key={wallet.id}>
                <Link href={`/wallets/${wallet.id}`} className="flex min-h-11 items-center justify-between rounded-[1rem] bg-finance-background px-3 py-2">
                  <span className="text-finance-muted line-through">{wallet.name}</span>
                  <span className="text-xs text-finance-muted">{wallet.currency}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
