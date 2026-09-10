import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getWalletBalance, listArchivedWallets, listMyWallets } from "@/features/wallets/api";
import { formatCurrency } from "@/lib/utils/money";
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        title="กระเป๋าเงิน"
        fallbackHref="/finance"
        rightAction={<Link href="/wallets/new" aria-label="เพิ่มกระเป๋าเงิน" className="flex size-11 items-center justify-center rounded-full bg-primary text-xl text-primary-foreground">+</Link>}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground-muted">ส่วนตัว</h2>
        {personal.length === 0 ? (
          <EmptyState title="ยังไม่มีกระเป๋าเงินส่วนตัว" description="เพิ่มบัญชีธนาคารหรือเงินสดของคุณ" />
        ) : (
          personal.map(({ wallet, balance }) => <WalletCard key={wallet.id} id={wallet.id} name={wallet.name} balance={balance} currency={wallet.currency} scope="ส่วนตัว" />)
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground-muted">ครอบครัว</h2>
        {household.length === 0 ? (
          <EmptyState title="ยังไม่มีกระเป๋าเงินครอบครัว" description="สร้างครอบครัวก่อนเพื่อเพิ่มกระเป๋าเงินร่วมกัน" />
        ) : (
          household.map(({ wallet, balance }) => <WalletCard key={wallet.id} id={wallet.id} name={wallet.name} balance={balance} currency={wallet.currency} scope="ครอบครัว" />)
        )}
      </section>

      {archivedWallets.length > 0 ? (
        <details className="rounded-card border border-border bg-surface-muted px-4 py-2">
          <summary className="cursor-pointer text-sm text-foreground-muted">กระเป๋าเงินที่เก็บถาวร ({archivedWallets.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {archivedWallets.map((wallet) => (
              <li key={wallet.id}>
                <Link href={`/wallets/${wallet.id}`}>
                  <Card className="flex items-center justify-between">
                    <span className="text-foreground-muted line-through">{wallet.name}</span>
                    <span className="text-xs text-foreground-muted">{wallet.currency}</span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function WalletCard({ id, name, balance, currency, scope }: { id: string; name: string; balance: string; currency: string; scope: string }) {
  return (
    <Link href={`/wallets/${id}`} className="block min-h-11 rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <Card className="flex min-h-16 items-center justify-between gap-3">
        <span><span className="block font-medium">{name}</span><span className="text-xs text-foreground-muted">{currency} · {scope}</span></span>
        <span className="flex items-center gap-3"><span className="tabular-nums font-medium">{formatCurrency(balance, currency)}</span><span aria-hidden="true" className="text-xl text-foreground-muted">›</span></span>
      </Card>
    </Link>
  );
}
