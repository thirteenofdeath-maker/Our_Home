"use server";

import { buildCategoryTree } from "@/features/categories/domain/tree";
import { listCategoriesForWallet } from "@/features/categories/api";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listPocketsForWallet, listPocketsWithBalances } from "@/features/pockets/api";
import type { Pocket } from "@/features/pockets/types";
import { listTags } from "@/features/tags/api";
import { getWallet, listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";
import type { TransferEndpoint } from "@/features/transactions/domain/unified-transfer";

/**
 * These exist ONLY to let the Finance quick-add sheet (a client
 * component with no page navigation to trigger a fresh server render)
 * load the exact same props the full-page routes already load —
 * `/wallets/[walletId]/transactions/new`, `/wallets/[walletId]/transfer/
 * pocket`, `/wallets/[walletId]/transfer/wallet`. Every call here goes
 * through the SAME existing selectors those pages use; nothing new is
 * queried, computed, or validated.
 */

export async function getIncomeExpenseSheetData(walletId: string, transactionType: "INCOME" | "EXPENSE") {
  const { supabase } = await requireUser();
  const [wallet, wallets] = await Promise.all([getWallet(supabase, walletId), listMyWallets(supabase)]);
  if (!wallet) throw new Error("ไม่พบกระเป๋าเงิน");

  const [pockets, categories, tags] = await Promise.all([
    listPocketsForWallet(supabase, walletId),
    listCategoriesForWallet(supabase, { transactionType, wallet }),
    listTags(supabase, { scope: wallet.scope, householdId: wallet.household_id }),
  ]);

  return {
    wallets: wallets.map(({ id, name, currency, scope }) => ({ id, name, currency, scope })),
    pockets,
    categories: buildCategoryTree(categories),
    tags,
  };
}

export async function getPocketTransferSheetData(walletId: string) {
  const { supabase } = await requireUser();
  const wallet = await getWallet(supabase, walletId);
  if (!wallet) throw new Error("ไม่พบกระเป๋าเงิน");

  const [pockets, tags] = await Promise.all([
    listPocketsForWallet(supabase, walletId),
    listTags(supabase, { scope: wallet.scope, householdId: wallet.household_id }),
  ]);

  return { pockets, tags };
}

export async function getWalletTransferSheetData(walletId: string) {
  const { supabase } = await requireUser();
  const wallet = await getWallet(supabase, walletId);
  if (!wallet) throw new Error("ไม่พบกระเป๋าเงิน");

  const allWallets = await listMyWallets(supabase);
  // Same Milestone 1 restriction mirrored from create_wallet_transfer,
  // copied verbatim from wallets/[walletId]/transfer/wallet/page.tsx —
  // only wallets sharing the same owner/household are valid targets.
  const otherWallets = allWallets.filter(
    (w) => w.id !== wallet.id && w.scope === wallet.scope && w.owner_user_id === wallet.owner_user_id && w.household_id === wallet.household_id,
  );

  const [fromPockets, pocketsByWalletEntries, tags] = await Promise.all([
    listPocketsForWallet(supabase, walletId),
    Promise.all(otherWallets.map(async (w) => [w.id, await listPocketsForWallet(supabase, w.id)] as const)),
    listTags(supabase, { scope: wallet.scope, householdId: wallet.household_id }),
  ]);
  const pocketsByWallet: Record<string, Pocket[]> = Object.fromEntries(pocketsByWalletEntries);

  return { fromWallet: wallet, fromPockets, otherWallets, pocketsByWallet, tags };
}

export async function getUnifiedTransferSheetData(walletId: string) {
  const { supabase } = await requireUser();
  const wallet = await getWallet(supabase, walletId);
  if (!wallet || wallet.is_archived) throw new Error("ไม่พบกระเป๋าเงิน");

  const wallets = (await listMyWallets(supabase)).filter(
    (candidate) =>
      candidate.scope === wallet.scope &&
      candidate.owner_user_id === wallet.owner_user_id &&
      candidate.household_id === wallet.household_id,
  );
  const pocketsByWallet = await Promise.all(
    wallets.map(async (candidate) => [candidate, await listPocketsWithBalances(supabase, candidate.id)] as const),
  );
  const endpoints: TransferEndpoint[] = pocketsByWallet.flatMap(([candidate, pockets]) =>
    pockets.map((pocket) => ({
      walletId: candidate.id,
      walletName: candidate.name,
      pocketId: pocket.id,
      pocketName: pocket.name,
      currency: candidate.currency,
      balance: pocket.balance,
    })),
  );
  const tags = await listTags(supabase, { scope: wallet.scope, householdId: wallet.household_id });
  return { initialWalletId: wallet.id, endpoints, tags };
}

/**
 * Only needed by GlobalQuickAdd's zero-wallet fallback (create the very
 * first wallet before anything else is possible) — deliberately NOT
 * fetched on every Finance page load; see GlobalQuickAdd.tsx.
 */
export async function getCreateWalletSheetData() {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  return { hasHousehold: Boolean(household) };
}
