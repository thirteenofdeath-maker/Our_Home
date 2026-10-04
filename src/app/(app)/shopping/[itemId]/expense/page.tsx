import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { listCategoriesForWallet } from "@/features/categories/api";
import { buildCategoryTree } from "@/features/categories/domain/tree";
import { listCreditCardAccounts } from "@/features/credit-cards/api";
import { listPocketsWithBalancesForWallets } from "@/features/pockets/api";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { getShoppingItem } from "@/features/shopping/api";
import { ShoppingExpenseForm } from "@/features/shopping/components/ShoppingExpenseForm";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

type ShoppingExpensePageProps = {
  params: Promise<{ itemId: string }>;
};

export async function ShoppingExpensePage({
  params,
}: ShoppingExpensePageProps) {
  const { itemId } = await params;
  const { supabase, user } = await requireUser();
  const [item, wallets, household] = await Promise.all([
    getShoppingItem(supabase, itemId),
    listMyWallets(supabase),
    getMyPrimaryHousehold(supabase, user.id),
  ]);
  if (
    !item ||
    item.expense_transaction_id ||
    !household ||
    household.id !== item.household_id ||
    household.myRole === "observer"
  )
    notFound();

  const eligibleWallets = wallets.filter(
    (wallet) =>
      (wallet.scope === "PERSONAL" && wallet.owner_user_id === user.id) ||
      (wallet.scope === "HOUSEHOLD" && wallet.household_id === household.id),
  );
  if (!eligibleWallets.length) {
    return (
      <div className="flex flex-col gap-4 pb-8">
        <PageHeader title="สร้างรายจ่าย" backHref="/calendar?view=shopping" />
        <Card className="rounded-[1.5rem] text-center">
          <p className="font-medium">ต้องมีกระเป๋าเงินก่อนสร้างรายจ่าย</p>
          <Link className="mt-3 inline-block text-primary" href="/wallets/new">
            สร้างกระเป๋าเงิน
          </Link>
        </Card>
      </div>
    );
  }

  const [pockets, categories, cards] = await Promise.all([
    listPocketsWithBalancesForWallets(
      supabase,
      eligibleWallets.map((wallet) => wallet.id),
    ),
    listCategoriesForWallet(supabase, {
      transactionType: "EXPENSE",
      wallet: {
        scope: "HOUSEHOLD",
        owner_user_id: null,
        household_id: household.id,
      },
    }),
    listCreditCardAccounts(supabase),
  ]);
  const cardByPocketId = new Map(cards.map((card) => [card.pocketId, card]));
  const endpoints = eligibleWallets.flatMap((wallet) =>
    pockets
      .filter((pocket) => pocket.wallet_id === wallet.id)
      .map((pocket) => {
        const card = cardByPocketId.get(pocket.id);
        return {
          walletId: wallet.id,
          walletName: `${wallet.name} · ${wallet.scope === "HOUSEHOLD" ? "ครอบครัว" : "ส่วนตัว"}`,
          pocketId: pocket.id,
          pocketName: pocket.name,
          currency: pocket.currency,
          balance: pocket.balance,
          creditCard: card
            ? {
                availableCredit: card.availableCredit,
                liability: card.liability,
              }
            : undefined,
        };
      }),
  );
  const details = [
    `${Number(item.quantity)}${item.unit ? ` ${item.unit}` : ""}`,
    item.store,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-8">
      <PageHeader
        title="สร้างรายจ่ายจากรายการซื้อของ"
        backHref="/calendar?view=shopping"
      />
      <Card className="rounded-[1.25rem] bg-finance-primary-soft/55">
        <p className="font-semibold text-finance-text">{item.name}</p>
        <p className="mt-1 text-sm text-finance-muted">{details}</p>
      </Card>
      <ShoppingExpenseForm
        shoppingItemId={item.id}
        endpoints={endpoints}
        categories={buildCategoryTree(categories)}
        itemCurrency={item.currency}
        defaultAmount={String(item.estimated_amount ?? "")}
        defaultTitle={item.name}
        defaultNote={details || item.note}
      />
    </div>
  );
}

export default async function LegacyShoppingExpensePage({
  params,
}: ShoppingExpensePageProps) {
  const { itemId } = await params;
  redirect(`/calendar/shopping/${itemId}/expense`);
}
