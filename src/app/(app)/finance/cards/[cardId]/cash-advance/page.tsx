import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { getCreditCard } from "@/features/credit-cards/api";
import { CreditCardCashAdvanceForm } from "@/features/credit-cards/components/CreditCardCashAdvanceForm";
import { listPocketsForWallet } from "@/features/pockets/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function CreditCardCashAdvancePage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const { supabase } = await requireUser();
  const card = await getCreditCard(supabase, cardId);
  if (!card || card.isArchived || Number(card.availableCredit) <= 0) notFound();

  const wallets = (await listMyWallets(supabase)).filter((wallet) =>
    !wallet.is_archived
    && wallet.wallet_type !== "CREDIT_CARD"
    && wallet.currency === card.currency
    && wallet.scope === card.scope
    && wallet.household_id === card.householdId
  );
  const pocketPairs = await Promise.all(
    wallets.map(async (wallet) => [wallet.id, await listPocketsForWallet(supabase, wallet.id)] as const),
  );

  return (
    <div className="finance-scope mx-auto flex w-full max-w-xl flex-col gap-4">
      <PageHeader title="กดเงินสดจากบัตร" backHref={`/finance/cards/${cardId}`} />
      <CreditCardCashAdvanceForm card={card} wallets={wallets} pocketsByWallet={Object.fromEntries(pocketPairs)} />
    </div>
  );
}
