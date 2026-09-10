import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { listPocketsForWallet } from "@/features/pockets/api";
import type { Pocket } from "@/features/pockets/types";
import { listTags } from "@/features/tags/api";
import { WalletTransferForm } from "@/features/transactions/components/WalletTransferForm";
import { getWallet, listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function WalletTransferPage({
  params,
}: {
  params: Promise<{ walletId: string }>;
}) {
  const { walletId } = await params;
  const { supabase } = await requireUser();

  const wallet = await getWallet(supabase, walletId);
  if (!wallet) notFound();

  const allWallets = await listMyWallets(supabase);
  // Milestone 1 restriction mirrored from create_wallet_transfer: only
  // wallets sharing the same owner/household are valid transfer targets.
  const otherWallets = allWallets.filter(
    (w) =>
      w.id !== wallet.id &&
      w.scope === wallet.scope &&
      w.owner_user_id === wallet.owner_user_id &&
      w.household_id === wallet.household_id,
  );

  const [fromPockets, pocketsByWalletEntries, tags] = await Promise.all([
    listPocketsForWallet(supabase, walletId),
    Promise.all(otherWallets.map(async (w) => [w.id, await listPocketsForWallet(supabase, w.id)] as const)),
    listTags(supabase, { scope: wallet.scope, householdId: wallet.household_id }),
  ]);
  const pocketsByWallet: Record<string, Pocket[]> = Object.fromEntries(pocketsByWalletEntries);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">โอนไปกระเป๋าเงินอื่น</h1>
      {otherWallets.length === 0 ? (
        <EmptyState title="ไม่มีกระเป๋าเงินปลายทาง" description="เพิ่มกระเป๋าเงินอีกใบก่อนโอนเงินระหว่างกระเป๋า" />
      ) : (
        <WalletTransferForm
          fromWallet={wallet}
          fromPockets={fromPockets}
          otherWallets={otherWallets}
          pocketsByWallet={pocketsByWallet}
          tags={tags}
        />
      )}
    </div>
  );
}
