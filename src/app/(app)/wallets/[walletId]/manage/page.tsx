import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { listArchivedPocketsForWallet, listPocketsWithBalances } from "@/features/pockets/api";
import { PocketManagerList } from "@/features/pockets/components/PocketManagerList";
import { getWallet } from "@/features/wallets/api";
import { RenameWalletForm } from "@/features/wallets/components/RenameWalletForm";
import { WalletLifecycleControls } from "@/features/wallets/components/WalletLifecycleControls";
import { requireUser } from "@/lib/auth/require-user";

export default async function WalletManagementPage({ params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = await params;
  const { supabase } = await requireUser();
  const wallet = await getWallet(supabase, walletId);
  if (!wallet) notFound();
  const [pockets, archivedPockets] = await Promise.all([
    listPocketsWithBalances(supabase, walletId),
    listArchivedPocketsForWallet(supabase, walletId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader title="จัดการกระเป๋าเงิน" />
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">แก้ไขกระเป๋าเงิน</h2>
        <RenameWalletForm wallet={wallet} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">จัดการ Pocket</h2>
        <PocketManagerList walletId={wallet.id} pockets={pockets} archivedPockets={archivedPockets} currency={wallet.currency} />
      </section>
      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h2 className="font-semibold text-danger">การจัดการขั้นสูง</h2>
        <WalletLifecycleControls wallet={wallet} />
      </section>
    </div>
  );
}
