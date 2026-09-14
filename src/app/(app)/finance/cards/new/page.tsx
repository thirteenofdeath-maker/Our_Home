import { PageHeader } from "@/components/shared/PageHeader";
import { CreditCardForm } from "@/features/credit-cards/components/CreditCardForm";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function NewCreditCardPage() {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  return (
    <div className="finance-scope mx-auto flex w-full max-w-xl flex-col gap-4">
      <PageHeader title="เพิ่มบัตรเครดิต" backHref="/finance/cards" />
      <CreditCardForm hasHousehold={Boolean(household)} />
    </div>
  );
}
