import { notFound } from "next/navigation";

import { FinanceAddWorkspace } from "@/features/finance/components/FinanceAddWorkspace";
import {
  getIncomeExpenseSheetData,
  getUnifiedTransferSheetData,
} from "@/features/finance/quick-add-data";
import { getInstallmentSheetData } from "@/features/installments/quick-add-data";
import { listPocketsForWallet } from "@/features/pockets/api";
import { getWallet, listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ walletId?: string }>;
}) {
  const query = await searchParams;
  const { supabase } = await requireUser();
  const wallets = await listMyWallets(supabase);
  const requestedWallet = query.walletId
    ? await getWallet(supabase, query.walletId)
    : null;
  const wallet =
    requestedWallet && !requestedWallet.is_archived
      ? requestedWallet
      : wallets[0];
  if (!wallet) notFound();

  const pocketSets = await Promise.all(
    wallets.map(async (item) => ({
      wallet: item,
      pockets: await listPocketsForWallet(supabase, item.id),
    })),
  );
  const creditCard =
    pocketSets.find((item) =>
      item.pockets.some((pocket) => pocket.pocket_type === "CREDIT_CARD"),
    )?.wallet ?? null;
  const [
    expense,
    income,
    transfer,
    installment,
    cardExpense,
    cardIncome,
    cardTransfer,
  ] = await Promise.all([
    getIncomeExpenseSheetData(wallet.id, "EXPENSE"),
    getIncomeExpenseSheetData(wallet.id, "INCOME"),
    getUnifiedTransferSheetData(wallet.id),
    getInstallmentSheetData(),
    creditCard
      ? getIncomeExpenseSheetData(creditCard.id, "EXPENSE")
      : Promise.resolve(null),
    creditCard
      ? getIncomeExpenseSheetData(creditCard.id, "INCOME")
      : Promise.resolve(null),
    creditCard
      ? getUnifiedTransferSheetData(creditCard.id)
      : Promise.resolve(null),
  ]);

  return (
    <FinanceAddWorkspace
      walletId={wallet.id}
      expense={expense}
      income={income}
      transfer={transfer}
      creditCardId={creditCard?.id ?? null}
      cardExpense={cardExpense}
      cardIncome={cardIncome}
      cardTransfer={cardTransfer}
      installment={installment}
    />
  );
}
