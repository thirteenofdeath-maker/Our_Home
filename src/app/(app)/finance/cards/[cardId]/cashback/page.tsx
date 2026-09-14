import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { getCreditCard } from "@/features/credit-cards/api";
import { CreditCardCashbackForm } from "@/features/credit-cards/components/CreditCardCashbackForm";
import { requireUser } from "@/lib/auth/require-user";

export default async function CreditCardCashbackPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  const { supabase } = await requireUser();
  const card = await getCreditCard(supabase, cardId);
  if (!card || card.isArchived) notFound();

  return (
    <div className="finance-scope mx-auto flex w-full max-w-xl flex-col gap-4">
      <PageHeader title="บันทึก Cashback" backHref={`/finance/cards/${cardId}`} />
      <CreditCardCashbackForm card={card} />
    </div>
  );
}
