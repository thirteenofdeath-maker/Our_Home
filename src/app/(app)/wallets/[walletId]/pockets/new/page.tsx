import { notFound } from "next/navigation";

import { AddPocketForm } from "@/features/pockets/components/AddPocketForm";
import { getWallet } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function NewPocketPage({ params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = await params;
  if (process.env.NODE_ENV === "development") {
    console.log("[pockets/new] page reached", { walletId });
  }
  const { supabase } = await requireUser();
  const wallet = await getWallet(supabase, walletId);
  if (!wallet) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-foreground-muted">{wallet.name}</p>
        <h1 className="text-xl font-semibold">เพิ่ม Pocket</h1>
      </div>
      <AddPocketForm walletId={walletId} />
    </div>
  );
}
