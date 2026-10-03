import { getMyPrimaryHousehold } from "@/features/household/api";
import { GoalForm } from "@/features/goals/components/GoalForm";
import {
  groupPocketsByWallet,
  listPocketsWithBalancesForWallets,
} from "@/features/pockets/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";
export default async function Page() {
  const { supabase, user } = await requireUser();
  const [h, wallets] = await Promise.all([
    getMyPrimaryHousehold(supabase, user.id),
    listMyWallets(supabase),
  ]);
  const walletIds = wallets.map((wallet) => wallet.id);
  const pockets = groupPocketsByWallet(
    walletIds,
    await listPocketsWithBalancesForWallets(supabase, walletIds),
  );
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">เพิ่มเป้าหมาย</h1>
      <GoalForm wallets={wallets} pockets={pockets} hasHousehold={Boolean(h)} />
    </div>
  );
}
