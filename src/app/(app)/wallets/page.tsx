import Link from "next/link";

import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getWalletBalance, listMyWallets } from "@/features/wallets/api";
import { formatCurrency } from "@/lib/utils/money";
import { requireUser } from "@/lib/auth/require-user";

export default async function WalletsPage() {
  const { supabase } = await requireUser();
  const wallets = await listMyWallets(supabase);

  const withBalance = await Promise.all(
    wallets.map(async (wallet) => ({ wallet, balance: await getWalletBalance(supabase, wallet.id) })),
  );

  const personal = withBalance.filter((w) => w.wallet.scope === "PERSONAL");
  const household = withBalance.filter((w) => w.wallet.scope === "HOUSEHOLD");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">กระเป๋าเงิน</h1>
        <Link href="/wallets/new" className={buttonClassName("primary", "md", "w-auto px-4")}>
          + เพิ่มกระเป๋าเงิน
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground-muted">ส่วนตัว</h2>
        {personal.length === 0 ? (
          <EmptyState title="ยังไม่มีกระเป๋าเงินส่วนตัว" description="เพิ่มบัญชีธนาคารหรือเงินสดของคุณ" />
        ) : (
          personal.map(({ wallet, balance }) => <WalletCard key={wallet.id} id={wallet.id} name={wallet.name} balance={balance} currency={wallet.currency} />)
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground-muted">ครอบครัว</h2>
        {household.length === 0 ? (
          <EmptyState title="ยังไม่มีกระเป๋าเงินครอบครัว" description="สร้างครอบครัวก่อนเพื่อเพิ่มกระเป๋าเงินร่วมกัน" />
        ) : (
          household.map(({ wallet, balance }) => <WalletCard key={wallet.id} id={wallet.id} name={wallet.name} balance={balance} currency={wallet.currency} />)
        )}
      </section>
    </div>
  );
}

function WalletCard({ id, name, balance, currency }: { id: string; name: string; balance: string; currency: string }) {
  return (
    <Link href={`/wallets/${id}`}>
      <Card className="flex items-center justify-between">
        <span className="font-medium">{name}</span>
        <span className="tabular-nums">{formatCurrency(balance, currency)}</span>
      </Card>
    </Link>
  );
}
