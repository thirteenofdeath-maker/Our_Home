import type { Database } from "@/types/database";

export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type TransactionEntry = Database["public"]["Tables"]["transaction_entries"]["Row"];

export interface TransactionHistoryItem {
  entryId: string;
  amount: string;
  transactionId: string;
  transactionType: Transaction["transaction_type"];
  title: string | null;
  note: string | null;
  occurredAt: string;
  categoryName: string | null;
}
