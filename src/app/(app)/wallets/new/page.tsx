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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <PageHeader title="เพิ่มกระเป๋าเงิน" fallbackHref="/wallets" />
      <WalletForm
        defaultScope={scope === "HOUSEHOLD" && household ? "HOUSEHOLD" : "PERSONAL"}
        hasHousehold={Boolean(household)}
      />
    </div>
  );
}
import { PageHeader } from "@/components/shared/PageHeader";
