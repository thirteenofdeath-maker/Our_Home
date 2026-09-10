import { notFound } from "next/navigation";

import { QuickAddChoices } from "@/components/shared/GlobalQuickAdd";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { getWallet } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function Page({ searchParams }: { searchParams: Promise<{ walletId?: string }> }) {
  const query = await searchParams;
  const { supabase } = await requireUser();
  if (!query.walletId) notFound();
  const wallet = await getWallet(supabase, query.walletId);
  if (!wallet || wallet.is_archived) notFound();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <PageHeader title="เพิ่มรายการ" fallbackHref="/finance" />
      <Card className="py-3">
        <p className="text-xs text-foreground-muted">กระเป๋าเงินปัจจุบัน</p>
        <p className="font-semibold">{wallet.name} · {wallet.currency} · {wallet.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}</p>
      </Card>
      <QuickAddChoices walletId={wallet.id} />
    </div>
  );
}
