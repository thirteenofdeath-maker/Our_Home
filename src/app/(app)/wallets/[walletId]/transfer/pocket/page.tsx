import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { listPocketsForWallet } from "@/features/pockets/api";
import { PocketTransferForm } from "@/features/transactions/components/PocketTransferForm";
import { getWallet } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function PocketTransferPage({
  params,
}: {
  params: Promise<{ walletId: string }>;
}) {
  const { walletId } = await params;
  const { supabase } = await requireUser();

  const wallet = await getWallet(supabase, walletId);
  if (!wallet) notFound();

  const pockets = await listPocketsForWallet(supabase, walletId);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">โอนระหว่างช่อง</h1>
      {pockets.length < 2 ? (
        <EmptyState title="ต้องมีอย่างน้อย 2 ช่อง" description="เพิ่มช่องใหม่ในหน้ากระเป๋าเงินก่อนโอน" />
      ) : (
        <PocketTransferForm walletId={walletId} pockets={pockets} />
      )}
    </div>
  );
}
