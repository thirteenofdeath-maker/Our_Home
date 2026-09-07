import type { Database } from "@/types/database";

export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type TransactionEntry = Database["public"]["Tables"]["transaction_entries"]["Row"];

export interface TransactionHistoryItem {
  transactionId: string;
  transactionType: Transaction["transaction_type"];
  title: string | null;
  note: string | null;
  occurredAt: string;
  categoryName: string | null;
  /** Signed amount for THIS wallet — the wallet the history was requested for. */
  amount: string;
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
}
