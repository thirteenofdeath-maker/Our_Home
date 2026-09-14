import { notFound } from "next/navigation";

import { FinanceAddWorkspace } from "@/features/finance/components/FinanceAddWorkspace";
import {
  getCreditCardSheetData,
  getIncomeExpenseSheetData,
  getUnifiedTransferSheetData,
} from "@/features/finance/quick-add-data";
import { getInstallmentSheetData } from "@/features/installments/quick-add-data";
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

  const [expense, income, transfer, installment, cardData] = await Promise.all([
    getIncomeExpenseSheetData(wallet.id, "EXPENSE"),
    getIncomeExpenseSheetData(wallet.id, "INCOME"),
    getUnifiedTransferSheetData(wallet.id),
    getInstallmentSheetData(),
    getCreditCardSheetData(wallet.id),
  ]);

  return (
    <FinanceAddWorkspace
      walletId={wallet.id}
      expense={expense}
      income={income}
      transfer={transfer}
      cardData={cardData}
      installment={installment}
    />
  );
}
