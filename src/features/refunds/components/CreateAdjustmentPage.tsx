import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { listPocketsForWallet } from "@/features/pockets/api";
import type { Pocket } from "@/features/pockets/types";
import { listTags } from "@/features/tags/api";
import { getTransactionDetail } from "@/features/transactions/api";
import { listMyWallets } from "@/features/wallets/api";
import type { Wallet } from "@/features/wallets/types";
import { requireUser } from "@/lib/auth/require-user";

import { getRefundableSummary } from "../api";
import { ExpenseAdjustmentForm } from "./ExpenseAdjustmentForm";

const TITLE: Record<"REFUND" | "REIMBURSEMENT", string> = {
  REFUND: "คืนเงิน",
  REIMBURSEMENT: "เบิกคืน",
};

/**
 * Shared body for both /refund and /reimbursement create routes — same
 * authorization/data-loading, only the adjustment_kind and heading differ.
 * A Server Component (not a page itself) so each route's page.tsx stays a
 * trivial one-liner while this logic lives in exactly one place.
 */
export async function CreateAdjustmentPage({ transactionId, kind }: { transactionId: string; kind: "REFUND" | "REIMBURSEMENT" }) {
  const { supabase } = await requireUser();

  const transaction = await getTransactionDetail(supabase, transactionId);
  if (!transaction) notFound();
  if (transaction.transactionType !== "EXPENSE" || transaction.voidedAt || !transaction.walletId) notFound();

  const refundable = await getRefundableSummary(supabase, transactionId);
  if (!refundable) notFound();

  if (Number(refundable.remainingAdjustableAmount) <= 0) {
    return <EmptyState title="คืนเงินได้ครบแล้ว" description="รายการนี้ถูกคืนเงิน/เบิกคืนเต็มจำนวนแล้ว" />;
  }

  const allWallets = await listMyWallets(supabase);
  const originalWallet = allWallets.find((w) => w.id === transaction.walletId);
  // Same scope/owner/household as the original expense only — see
  // create_expense_adjustment_transaction's own check (0033); the
  // destination need not be the exact same wallet.
  const sameScopeWallets: Wallet[] = originalWallet
    ? allWallets.filter(
        (w) => w.scope === originalWallet.scope && w.owner_user_id === originalWallet.owner_user_id && w.household_id === originalWallet.household_id,
      )
    : allWallets.filter((w) => w.id === transaction.walletId);

  const [tags, pocketsByWalletEntries] = await Promise.all([
    listTags(supabase, {
      scope: originalWallet?.scope ?? "PERSONAL",
      householdId: originalWallet?.household_id ?? null,
    }),
    Promise.all(sameScopeWallets.map(async (w) => [w.id, await listPocketsForWallet(supabase, w.id)] as const)),
  ]);
  const pocketsByWallet: Record<string, Pocket[]> = Object.fromEntries(pocketsByWalletEntries);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{TITLE[kind]}</h1>
      <p className="text-sm text-foreground-muted">จากรายการ: {transaction.title || transaction.categoryName || "รายจ่าย"}</p>
      <ExpenseAdjustmentForm
        originalExpenseId={transactionId}
        adjustmentKind={kind}
        refundable={refundable}
        currency={transaction.currency ?? "THB"}
        wallets={sameScopeWallets}
        pocketsByWallet={pocketsByWallet}
        tags={tags}
      />
    </div>
  );
}
