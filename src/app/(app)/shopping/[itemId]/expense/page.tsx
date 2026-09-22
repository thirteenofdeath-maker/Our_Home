import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { listCategoriesForWallet } from "@/features/categories/api";
import { buildCategoryTree } from "@/features/categories/domain/tree";
import { listPocketsForWallet } from "@/features/pockets/api";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { getShoppingItem } from "@/features/shopping/api";
import { listTags } from "@/features/tags/api";
import { TransactionForm } from "@/features/transactions/components/TransactionForm";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function ShoppingExpensePage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
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

  const wallet = wallets.find((entry) => entry.currency === item.currency) ?? wallets[0];
  if (!wallet) {
    return (
      <div className="flex flex-col gap-4 pb-8">
        <PageHeader title="สร้างรายจ่าย" backHref="/shopping" />
        <Card className="rounded-[1.5rem] text-center">
          <p className="font-medium">ต้องมีกระเป๋าเงินก่อนสร้างรายจ่าย</p>
          <Link className="mt-3 inline-block text-primary" href="/wallets/new">
            สร้างกระเป๋าเงิน
          </Link>
        </Card>
      </div>
    );
  }

  const [pockets, categories, tags] = await Promise.all([
    listPocketsForWallet(supabase, wallet.id),
    listCategoriesForWallet(supabase, {
      transactionType: "EXPENSE",
      wallet,
    }),
    listTags(supabase, {
      scope: wallet.scope,
      householdId: wallet.household_id,
    }),
  ]);
  const currencyMatches = wallet.currency === item.currency;
  const details = [
    `${Number(item.quantity)}${item.unit ? ` ${item.unit}` : ""}`,
    item.store,
  ].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-8">
      <PageHeader title="สร้างรายจ่ายจากรายการซื้อของ" backHref="/shopping" />
      <Card className="rounded-[1.25rem] bg-finance-primary-soft/55">
        <p className="font-semibold text-finance-text">{item.name}</p>
        <p className="mt-1 text-sm text-finance-muted">{details}</p>
      </Card>
      <TransactionForm
        walletId={wallet.id}
        wallets={wallets.map(({ id, name, scope }) => ({ id, name, scope }))}
        transactionType="EXPENSE"
        pockets={pockets.filter((pocket) => pocket.pocket_type !== "CREDIT_CARD")}
        categories={buildCategoryTree(categories)}
        tags={tags}
        defaultAmount={currencyMatches ? String(item.estimated_amount ?? "") : undefined}
        defaultTitle={item.name}
        defaultNote={details || item.note}
        staleNotices={
          !currencyMatches && item.estimated_amount
            ? [`งบประมาณเป็น ${item.currency} แต่กระเป๋าที่ใช้เป็น ${wallet.currency} กรุณาระบุยอดที่ถูกต้อง`]
            : undefined
        }
        shoppingItemId={item.id}
      />
    </div>
  );
}
