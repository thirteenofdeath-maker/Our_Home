import type { TransactionHistoryItem } from "@/features/transactions/types";

/**
 * Every aggregate here is grouped by currency — never summed across
 * currencies (see get_finance_hub_summary, 0028). A single-currency
 * household simply has one entry in each array; a mixed-currency one has
 * several, and the UI renders one line per entry.
 */
export interface FinanceSummary {
  walletBalances: Array<{ walletId: string; currency: string; amount: string }>;
  currencyTotals: Array<{ currency: string; amount: string }>;
  monthTotals: Array<{ currency: string; income: string; expense: string }>;
  categoryTotals: Array<{ categoryId: string | null; name: string; currency: string; amount: string }>;
}

export type FinanceRecentTransaction = TransactionHistoryItem & { currency: string };
