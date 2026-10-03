"use server";

import { buildCategoryTree } from "@/features/categories/domain/tree";
import { listCategoriesForWallet } from "@/features/categories/api";
import { listCreditCardAccounts } from "@/features/credit-cards/api";
import { getMyPrimaryHousehold } from "@/features/household/api";
import {
  groupPocketsByWallet,
  listPocketsForWallet,
  listPocketsForWallets,
  listPocketsWithBalancesForWallets,
} from "@/features/pockets/api";
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

export async function getIncomeExpenseSheetData(
  walletId: string,
  transactionType: "INCOME" | "EXPENSE",
) {
  const { supabase } = await requireUser();
  const [wallet, wallets] = await Promise.all([
    getWallet(supabase, walletId),
    listMyWallets(supabase),
  ]);
  if (!wallet) throw new Error("ไม่พบกระเป๋าเงิน");

  const compatibleWallets = wallets.filter(
    (candidate) =>
      candidate.scope === wallet.scope &&
      candidate.owner_user_id === wallet.owner_user_id &&
      candidate.household_id === wallet.household_id,
  );
  const compatibleWalletIds = compatibleWallets.map(
    (candidate) => candidate.id,
  );
  const [categories, tags, allPockets, cards] = await Promise.all([
    listCategoriesForWallet(supabase, { transactionType, wallet }),
    listTags(supabase, {
      scope: wallet.scope,
      householdId: wallet.household_id,
    }),
    listPocketsWithBalancesForWallets(supabase, compatibleWalletIds),
    transactionType === "EXPENSE"
      ? listCreditCardAccounts(supabase)
      : Promise.resolve([]),
  ]);
  const cardByPocketId = new Map(cards.map((card) => [card.pocketId, card]));
  const canUsePocket = (pocket: Pocket) =>
    transactionType === "EXPENSE" || pocket.pocket_type !== "CREDIT_CARD";

  return {
    wallets: compatibleWallets.map(({ id, name, scope }) => ({
      id,
      name,
      scope,
    })),
    pockets: allPockets
      .filter((pocket) => pocket.wallet_id === walletId)
      .filter(canUsePocket),
    endpoints: compatibleWallets.flatMap((candidate) =>
      allPockets
        .filter((item) => item.wallet_id === candidate.id)
        .filter(canUsePocket)
        .map((pocket) => {
          const card = cardByPocketId.get(pocket.id);
          return {
            walletId: candidate.id,
            walletName: candidate.name,
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
    ),
    categories: buildCategoryTree(categories),
    tags,
  };
}

export async function getAttributedHouseholdExpenseSheetData(
  householdId: string,
) {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  if (!household || household.id !== householdId) {
    throw new Error("ไม่พบครอบครัว");
  }

  const wallets = (await listMyWallets(supabase)).filter(
    (wallet) => wallet.scope === "PERSONAL" && wallet.owner_user_id === user.id,
  );
  const walletIds = wallets.map((wallet) => wallet.id);
  const [categories, allPockets, cards] = await Promise.all([
    listCategoriesForWallet(supabase, {
      transactionType: "EXPENSE",
      wallet: {
        scope: "HOUSEHOLD",
        owner_user_id: null,
        household_id: householdId,
      },
    }),
    listPocketsWithBalancesForWallets(supabase, walletIds),
    listCreditCardAccounts(supabase),
  ]);
  const cardByPocketId = new Map(cards.map((card) => [card.pocketId, card]));

  return {
    categories: buildCategoryTree(categories),
    endpoints: wallets.flatMap((wallet) =>
      allPockets
        .filter((pocket) => pocket.wallet_id === wallet.id)
        .map((pocket) => {
          const card = cardByPocketId.get(pocket.id);
          return {
            walletId: wallet.id,
            walletName: wallet.name,
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
    ),
  };
}

export async function getPocketTransferSheetData(walletId: string) {
  const { supabase } = await requireUser();
  const wallet = await getWallet(supabase, walletId);
  if (!wallet) throw new Error("ไม่พบกระเป๋าเงิน");

  const [pockets, tags] = await Promise.all([
    listPocketsForWallet(supabase, walletId),
    listTags(supabase, {
      scope: wallet.scope,
      householdId: wallet.household_id,
    }),
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
    (w) =>
      w.id !== wallet.id &&
      w.scope === wallet.scope &&
      w.owner_user_id === wallet.owner_user_id &&
      w.household_id === wallet.household_id,
  );

  const walletIds = [
    wallet.id,
    ...otherWallets.map((candidate) => candidate.id),
  ];
  const [allPockets, tags] = await Promise.all([
    listPocketsForWallets(supabase, walletIds),
    listTags(supabase, {
      scope: wallet.scope,
      householdId: wallet.household_id,
    }),
  ]);
  const pocketsByWallet = groupPocketsByWallet(walletIds, allPockets);

  return {
    fromWallet: wallet,
    fromPockets: pocketsByWallet[wallet.id] ?? [],
    otherWallets,
    pocketsByWallet,
    tags,
  };
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
  const walletIds = wallets.map((candidate) => candidate.id);
  const allPockets = await listPocketsWithBalancesForWallets(
    supabase,
    walletIds,
  );
  const endpoints: TransferEndpoint[] = wallets.flatMap((candidate) =>
    allPockets
      .filter((pocket) => pocket.wallet_id === candidate.id)
      .filter((pocket) => pocket.pocket_type !== "CREDIT_CARD")
      .map((pocket) => ({
        walletId: candidate.id,
        walletName: candidate.name,
        pocketId: pocket.id,
        pocketName: pocket.name,
        currency: pocket.currency,
        balance: pocket.balance,
      })),
  );
  const tags = await listTags(supabase, {
    scope: wallet.scope,
    householdId: wallet.household_id,
  });
  return { initialWalletId: wallet.id, endpoints, tags };
}

export async function getCreditCardSheetData(walletId: string) {
  const { supabase } = await requireUser();
  const wallet = await getWallet(supabase, walletId);
  if (!wallet || wallet.is_archived) throw new Error("ไม่พบกระเป๋าเงิน");

  const wallets = (await listMyWallets(supabase)).filter(
    (candidate) =>
      candidate.scope === wallet.scope &&
      candidate.owner_user_id === wallet.owner_user_id &&
      candidate.household_id === wallet.household_id,
  );
  const walletIdList = wallets.map((candidate) => candidate.id);
  const [allPockets, allCards] = await Promise.all([
    listPocketsWithBalancesForWallets(supabase, walletIdList),
    listCreditCardAccounts(supabase),
  ]);
  const walletIds = new Set(wallets.map((candidate) => candidate.id));
  return {
    cards: allCards.filter((card) => walletIds.has(card.walletId)),
    endpoints: wallets.flatMap((candidate) =>
      allPockets
        .filter((pocket) => pocket.wallet_id === candidate.id)
        .filter((pocket) => pocket.pocket_type !== "CREDIT_CARD")
        .map((pocket) => ({
          walletId: candidate.id,
          walletName: candidate.name,
          pocketId: pocket.id,
          pocketName: pocket.name,
          currency: pocket.currency,
          balance: pocket.balance,
        })),
    ),
  };
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

/**
 * Loaded only after a generic Finance FAB is actually mounted. Keeping this
 * out of the authenticated layout removes a wallets query from every app
 * route while preserving the same instant sheet after the short idle warmup.
 */
export async function getGlobalQuickAddBootstrapData() {
  const { supabase, user } = await requireUser();
  const wallets = await listMyWallets(supabase);
  if (wallets.length) {
    return { walletId: wallets[0].id, hasHousehold: true };
  }
  const household = await getMyPrimaryHousehold(supabase, user.id);
  return { walletId: null, hasHousehold: Boolean(household) };
}
