import { notFound } from "next/navigation";
import { getGoal } from "@/features/goals/api";
import { GoalForm } from "@/features/goals/components/GoalForm";
import { getMyPrimaryHousehold } from "@/features/household/api";
import {
  groupPocketsByWallet,
  listPocketsWithBalancesForWallets,
} from "@/features/pockets/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";
export default async function Page({
  params,
}: {
  params: Promise<{ goalId: string }>;
}) {
  const { goalId } = await params;
  const { supabase, user } = await requireUser();
  const [h, wallets] = await Promise.all([
    getMyPrimaryHousehold(supabase, user.id),
    listMyWallets(supabase),
  ]);
  const g = await getGoal(supabase, goalId, h?.id);
  if (!g) notFound();
  const walletIds = wallets.map((wallet) => wallet.id);
  const pockets = groupPocketsByWallet(
    walletIds,
    await listPocketsWithBalancesForWallets(supabase, walletIds),
  );
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">แก้ไขเป้าหมาย</h1>
      <GoalForm
        goal={g}
        wallets={wallets}
        pockets={pockets}
        hasHousehold={Boolean(h)}
      />
    </div>
  );
}
