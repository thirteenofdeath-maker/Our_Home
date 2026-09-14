import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { getCardEventForTransaction, getCreditCard } from "@/features/credit-cards/api";
import { CardPurchaseRefundForm } from "@/features/credit-cards/components/CardPurchaseRefundForm";
import { getRefundableSummary } from "@/features/refunds/api";
import { listTags } from "@/features/tags/api";
import { getAttributionForTransaction, getTransactionDetail } from "@/features/transactions/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function CardPurchaseRefundPage({
  params,
}: {
  params: Promise<{ cardId: string; transactionId: string }>;
}) {
  const { cardId, transactionId } = await params;
  const { supabase } = await requireUser();
  const [card, event, transaction, refundable, attribution] = await Promise.all([
    getCreditCard(supabase, cardId),
    getCardEventForTransaction(supabase, transactionId),
    getTransactionDetail(supabase, transactionId),
    getRefundableSummary(supabase, transactionId),
    getAttributionForTransaction(supabase, transactionId),
  ]);
  if (!card || !event || event.cardAccountId !== cardId || event.eventKinds.length !== 1 || event.eventKinds[0] !== "PURCHASE" || !transaction || !refundable) notFound();
  const tags = attribution ? null : await listTags(supabase, { scope: card.scope, householdId: card.householdId });
  return (
    <div className="finance-scope mx-auto flex w-full max-w-xl flex-col gap-4">
      <PageHeader title="คืนเงินเข้าบัตร" backHref={`/finance/transactions/${transactionId}`} />
      <CardPurchaseRefundForm
        transactionId={transactionId}
        walletId={card.walletId}
        refundable={refundable}
        currency={card.currency}
        tags={tags}
      />
    </div>
  );
}
