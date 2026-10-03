import { DebtCreateForm } from "@/features/debts/components/DebtForms";
import { getMyPrimaryHousehold } from "@/features/household/api";
import {
  groupPocketsByWallet,
  listPocketsWithBalancesForWallets,
} from "@/features/pockets/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";
export default async function Page() {
  const { supabase, user } = await requireUser();
  const [h, w] = await Promise.all([
    getMyPrimaryHousehold(supabase, user.id),
    listMyWallets(supabase),
  ]);
  const walletIds = w.map((wallet) => wallet.id);
  const p = groupPocketsByWallet(
    walletIds,
    await listPocketsWithBalancesForWallets(supabase, walletIds),
  );
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">เพิ่มหนี้/เงินให้ยืม</h1>
      <DebtCreateForm wallets={w} pockets={p} hasHousehold={Boolean(h)} />
    </div>
  );
}
