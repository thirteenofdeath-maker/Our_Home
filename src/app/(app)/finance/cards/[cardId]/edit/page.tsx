import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { getCreditCard } from "@/features/credit-cards/api";
import { CreditCardForm } from "@/features/credit-cards/components/CreditCardForm";
import { requireUser } from "@/lib/auth/require-user";

export default async function EditCreditCardPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  const { supabase } = await requireUser();
  const card = await getCreditCard(supabase, cardId);
  if (!card) notFound();
  return (
    <div className="finance-scope mx-auto flex w-full max-w-xl flex-col gap-4">
      <PageHeader
        title="แก้ไขข้อมูลบัตร"
        backHref={`/finance/cards/${cardId}`}
      />
      <CreditCardForm card={card} hasHousehold />
    </div>
  );
}
