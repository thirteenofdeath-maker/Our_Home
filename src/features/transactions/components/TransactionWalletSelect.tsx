"use client";

import { useRouter } from "next/navigation";

import { FinanceOptionField } from "@/features/finance/components/FinanceOptionField";

export interface TransactionWalletOption {
  id: string;
  name: string;
  scope: "PERSONAL" | "HOUSEHOLD";
}

export function transactionWalletHref(
  walletId: string,
  params: {
    transactionType: "INCOME" | "EXPENSE";
    returnTo?: string;
    templateId?: string;
    occurrenceId?: string;
  },
): string {
  const query = new URLSearchParams({ type: params.transactionType });
  if (params.returnTo) query.set("returnTo", params.returnTo);
  if (params.templateId) query.set("templateId", params.templateId);
  if (params.occurrenceId) query.set("occurrenceId", params.occurrenceId);
  return `/wallets/${walletId}/transactions/new?${query.toString()}`;
}

export function TransactionWalletSelect({
  wallets,
  currentWalletId,
  transactionType,
  returnTo,
  templateId,
  occurrenceId,
  onWalletChange,
  disabled,
}: {
  wallets: TransactionWalletOption[];
  currentWalletId: string;
  transactionType: "INCOME" | "EXPENSE";
  returnTo?: string;
  templateId?: string;
  occurrenceId?: string;
  /**
   * When provided, a wallet change calls this instead of navigating —
   * the caller (TransactionForm, in `variant="sheet"`) owns re-fetching
   * the new wallet's Pocket/Category/Tag data itself and stays mounted
   * in place. Omit for the full-page route, where `router.replace` to a
   * fresh URL for the chosen wallet remains the correct, unchanged
   * behavior (deep-linkable, works with browser back/forward).
   */
  onWalletChange?: (walletId: string) => void;
  disabled?: boolean;
}) {
  const router = useRouter();

  return (
    <FinanceOptionField
      label="กระเป๋าเงิน (Wallet)"
      title="เลือก Wallet"
      name={null}
      options={wallets.map((wallet) => ({
        id: wallet.id,
        label: wallet.name,
        description: wallet.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว",
      }))}
      value={currentWalletId}
      disabled={disabled}
      onChange={(nextWalletId) => {
          if (onWalletChange) {
            onWalletChange(nextWalletId);
            return;
          }
          router.replace(
            transactionWalletHref(nextWalletId, {
              transactionType,
              returnTo,
              templateId,
              occurrenceId,
            }),
          );
      }}
    />
  );
}
