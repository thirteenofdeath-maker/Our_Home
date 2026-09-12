import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { AddPocketForm } from "@/features/pockets/components/AddPocketForm";
import { getWallet } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function NewPocketPage({ params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = await params;
  const { supabase } = await requireUser();
  const wallet = await getWallet(supabase, walletId);
  if (!wallet) notFound();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <PageHeader title="เพิ่ม Pocket" />
      <p className="text-center text-sm text-foreground-muted">ในกระเป๋าเงิน {wallet.name}</p>
      <AddPocketForm walletId={walletId} />
    </div>
  );
}
