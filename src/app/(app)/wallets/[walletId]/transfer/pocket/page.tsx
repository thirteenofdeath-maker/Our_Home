import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClassName } from "@/components/ui/Button";
import { listPocketsForWallet } from "@/features/pockets/api";
import { listTags } from "@/features/tags/api";
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

  const [pockets, tags] = await Promise.all([
    listPocketsForWallet(supabase, walletId),
    listTags(supabase, { scope: wallet.scope, householdId: wallet.household_id }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">โอนระหว่างช่อง</h1>
      {pockets.length < 2 ? (
        <EmptyState
          title="ต้องมีอย่างน้อย 2 Pocket เพื่อโอนเงินระหว่าง Pocket"
          description="เพิ่ม Pocket ใหม่ก่อน แล้วโอนเงินจาก Main หรือ Pocket อื่น"
          action={
            <Link href={`/wallets/${walletId}/pockets/new`} className={buttonClassName("primary", "md")}>
              เพิ่ม Pocket
            </Link>
          }
        />
      ) : (
        <PocketTransferForm walletId={walletId} pockets={pockets} tags={tags} />
      )}
    </div>
  );
}
