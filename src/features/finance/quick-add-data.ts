"use server";

import { buildCategoryTree } from "@/features/categories/domain/tree";
import { listCategoriesForWallet } from "@/features/categories/api";
import { listCreditCardAccounts } from "@/features/credit-cards/api";
import { getMyPrimaryHousehold } from "@/features/household/api";
import {
  listPocketsForWallet,
  listPocketsWithBalances,
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

  const [pockets, categories, tags, pocketSets] = await Promise.all([
    listPocketsForWallet(supabase, walletId),
    listCategoriesForWallet(supabase, { transactionType, wallet }),
    listTags(supabase, {
      scope: wallet.scope,
      householdId: wallet.household_id,
    }),
    Promise.all(
      wallets.map(async (candidate) => ({
        wallet: candidate,
        pockets: await listPocketsWithBalances(supabase, candidate.id),
      })),
    ),
  ]);

  return {
    wallets: wallets.map(({ id, name, scope }) => ({ id, name, scope })),
    pockets: pockets.filter((pocket) => pocket.pocket_type !== "CREDIT_CARD"),
    endpoints: pocketSets.flatMap(({ wallet: candidate, pockets: items }) =>
      items
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

  const [fromPockets, pocketsByWalletEntries, tags] = await Promise.all([
    listPocketsForWallet(supabase, walletId),
    Promise.all(
      otherWallets.map(
        async (w) =>
          [w.id, await listPocketsForWallet(supabase, w.id)] as const,
      ),
    ),
    listTags(supabase, {
      scope: wallet.scope,
      householdId: wallet.household_id,
    }),
  ]);
  const pocketsByWallet: Record<string, Pocket[]> = Object.fromEntries(
    pocketsByWalletEntries,
  );

  return {
    fromWallet: wallet,
    fromPockets,
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
  const pocketsByWallet = await Promise.all(
    wallets.map(
      async (candidate) =>
        [
          candidate,
          await listPocketsWithBalances(supabase, candidate.id),
        ] as const,
    ),
  );
  const endpoints: TransferEndpoint[] = pocketsByWallet.flatMap(
    ([candidate, pockets]) =>
      pockets
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
  const [pocketSets, allCards] = await Promise.all([
    Promise.all(
      wallets.map(async (candidate) => ({
        wallet: candidate,
        pockets: await listPocketsWithBalances(supabase, candidate.id),
      })),
    ),
    listCreditCardAccounts(supabase),
  ]);
  const walletIds = new Set(wallets.map((candidate) => candidate.id));
  return {
    cards: allCards.filter((card) => walletIds.has(card.walletId)),
    endpoints: pocketSets.flatMap(({ wallet: candidate, pockets }) =>
      pockets
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
