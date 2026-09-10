import type { Database } from "@/types/database";

export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type TransactionEntry = Omit<Database["public"]["Tables"]["transaction_entries"]["Row"], "amount"> & {
  amount: string;
  /** Present on cross-wallet Finance Hub rows; wallet pages supply currency separately. */
  currency?: string;
};

export interface TransactionHistoryItem {
  transactionId: string;
  transactionType: Transaction["transaction_type"];
  title: string | null;
  note: string | null;
  occurredAt: string;
  categoryName: string | null;
  walletName: string;
  pocketName: string;
  creatorName: string | null;
  /** Signed amount for THIS wallet — the wallet the history was requested for. */
  amount: string;
  /** Null while active. Set (transactions.deleted_at) once voided — see docs/FINANCE.md Phase B. */
  voidedAt: string | null;
  /**
   * Set only where a single list can mix wallets of different currencies
   * (the Finance Hub's cross-wallet recent-activity feed — see
   * FinanceRecentTransaction). Wallet-scoped history omits this and
   * relies on the page's own single `currency` prop instead, since every
   * row there already belongs to the one wallet being viewed.
   */
  currency?: string;
  /**
   * Set only for a pocket transfer where BOTH entries belong to the
   * wallet being viewed (moving money between two of its own pockets).
   * Such a transfer is one logical event and is presented as one row
   * ("Main → Travel") instead of two unrelated ledger lines — see
   * docs/DOMAIN_RULES.md "Pocket transfer". A wallet-to-wallet transfer
   * only ever contributes one entry to this wallet's history, so it never
   * needs this field; it already reads as a single row.
   */
  pocketTransfer?: {
    fromPocketName: string;
    toPocketName: string;
    /** Positive decimal string — the amount moved. */
    amount: string;
  };
  walletTransfer?: {
    fromWalletName: string;
    fromPocketName: string;
    toWalletName: string;
    toPocketName: string;
  };
  /**
   * Set only when this row is itself a REFUND or REIMBURSEMENT (Phase D)
   * — stored at the DB level as an ordinary transaction_type = 'EXPENSE'
   * row with a positive entry (see docs/FINANCE.md Phase D), so this is
   * what the UI actually keys its distinct "คืนเงิน"/"เบิกคืน" label and
   * styling off of instead of `transactionType` directly.
   */
  adjustment?: {
    kind: "REFUND" | "REIMBURSEMENT";
    originalTitle: string | null;
  };
}
