import { WalletForm } from "@/features/wallets/components/WalletForm";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function NewWalletPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const { scope } = await searchParams;
  const household = await getMyPrimaryHousehold(supabase, user.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">เพิ่มกระเป๋าเงิน</h1>
      <WalletForm
        defaultScope={scope === "HOUSEHOLD" && household ? "HOUSEHOLD" : "PERSONAL"}
        hasHousehold={Boolean(household)}
      />
    </div>
  );
}
