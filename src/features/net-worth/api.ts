import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { listCreditCardAccounts } from "@/features/credit-cards/api";
import { listDebts } from "@/features/debts/api";
import { listPocketsWithBalances } from "@/features/pockets/api";
import { listArchivedWallets, listMyWallets } from "@/features/wallets/api";
import type { Database } from "@/types/database";

import {
  buildNetWorthDashboard,
  type NetWorthCurrencySummary,
} from "./domain";

export async function getNetWorthDashboard(
  supabase: SupabaseClient<Database>,
): Promise<NetWorthCurrencySummary[]> {
  const [activeWallets, archivedWallets] = await Promise.all([
    listMyWallets(supabase),
    listArchivedWallets(supabase),
  ]);
  const wallets = [...activeWallets, ...archivedWallets];

  const [pocketGroups, cards, householdResult, personalDebts] = await Promise.all([
    Promise.all(
      wallets.map(async (wallet) => ({
        wallet,
        pockets: await listPocketsWithBalances(supabase, wallet.id, {
          includeArchived: true,
        }),
      })),
    ),
    listCreditCardAccounts(supabase, { includeArchived: true }),
    supabase
      .from("debt_accounts")
      .select("household_id")
      .eq("scope", "HOUSEHOLD"),
    listDebts(supabase, "PERSONAL"),
  ]);

  if (householdResult.error) throw householdResult.error;

  const householdIds = [
    ...new Set(
      (householdResult.data ?? [])
        .map((row) => row.household_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const householdDebtGroups = await Promise.all(
    householdIds.map((householdId) =>
      listDebts(supabase, "HOUSEHOLD", householdId),
    ),
  );

  return buildNetWorthDashboard(
    pocketGroups.flatMap(({ wallet, pockets }) =>
      pockets.map((pocket) => ({
        walletId: wallet.id,
        walletName: wallet.name,
        pocketId: pocket.id,
        pocketName: pocket.name,
        pocketType: pocket.pocket_type,
        currency: pocket.currency,
        balance: pocket.balance,
        archived: wallet.is_archived || pocket.is_archived,
      })),
    ),
    cards.map((card) => ({
      pocketId: card.pocketId,
      liability: card.liability,
      cardCredit: card.cardCredit,
    })),
    [personalDebts, ...householdDebtGroups].flat().map((debt) => ({
      id: debt.id,
      name: debt.name,
      counterparty: debt.counterparty,
      debtType: debt.debtType,
      currency: debt.currency,
      outstanding: debt.outstanding,
      archived: Boolean(debt.archivedAt),
    })),
  );
}
