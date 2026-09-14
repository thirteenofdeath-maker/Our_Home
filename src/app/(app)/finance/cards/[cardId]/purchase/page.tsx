import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { listCategoriesForWallet } from "@/features/categories/api";
import { buildCategoryTree } from "@/features/categories/domain/tree";
import { getCreditCard } from "@/features/credit-cards/api";
import { CardPurchaseForm } from "@/features/credit-cards/components/CardPurchaseForm";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listTags } from "@/features/tags/api";
import { requireUser } from "@/lib/auth/require-user";
import { getWallet } from "@/features/wallets/api";

export default async function CardPurchasePage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const { supabase, user } = await requireUser();
  const card = await getCreditCard(supabase, cardId);
  if (!card || card.isArchived) notFound();
  const [household, wallet] = await Promise.all([
    getMyPrimaryHousehold(supabase, user.id),
    getWallet(supabase, card.walletId),
  ]);
  if (!wallet) notFound();

  const attributedHouseholdWallet = household
    ? { scope: "HOUSEHOLD" as const, owner_user_id: null, household_id: household.id }
    : null;

  const [personalCategories, householdCategories, personalTags, householdTags] = await Promise.all([
    card.scope === "PERSONAL" ? listCategoriesForWallet(supabase, { wallet, transactionType: "EXPENSE" }) : Promise.resolve([]),
    card.scope === "HOUSEHOLD"
      ? listCategoriesForWallet(supabase, { wallet, transactionType: "EXPENSE" })
      : attributedHouseholdWallet
        ? listCategoriesForWallet(supabase, { wallet: attributedHouseholdWallet, transactionType: "EXPENSE" })
        : Promise.resolve([]),
    card.scope === "PERSONAL" ? listTags(supabase, { scope: "PERSONAL" }) : Promise.resolve([]),
    card.scope === "HOUSEHOLD"
      ? listTags(supabase, { scope: "HOUSEHOLD", householdId: card.householdId })
      : household
        ? listTags(supabase, { scope: "HOUSEHOLD", householdId: household.id })
        : Promise.resolve([]),
  ]);

  return (
    <div className="finance-scope mx-auto flex w-full max-w-xl flex-col gap-4">
      <PageHeader title="ซื้อผ่านบัตร" backHref={`/finance/cards/${cardId}`} />
      <CardPurchaseForm
        card={card}
        personalCategories={buildCategoryTree(personalCategories)}
        householdCategories={buildCategoryTree(householdCategories)}
        personalTags={personalTags}
        householdTags={householdTags}
        hasHousehold={Boolean(household)}
      />
    </div>
  );
}
