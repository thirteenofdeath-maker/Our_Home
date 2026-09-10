import type { Database } from "@/types/database";

export type ExpenseAdjustmentKind = Database["public"]["Tables"]["expense_adjustments"]["Row"]["adjustment_kind"];

/** RLS-scoped read model from get_expense_refundable_summary — all decimal strings. */
export interface RefundableSummary {
  originalAmount: string;
  activeRefundTotal: string;
  activeReimbursementTotal: string;
  remainingAdjustableAmount: string;
}

/** One refund/reimbursement transaction shown under an original Expense's detail page. */
export interface AdjustmentSummaryItem {
  transactionId: string;
  kind: ExpenseAdjustmentKind;
  amount: string;
  occurredAt: string;
  walletName: string;
  pocketName: string;
  voidedAt: string | null;
}

/** "This transaction IS a refund/reimbursement" info, for a transaction's own detail view. */
export interface AdjustmentOrigin {
  kind: ExpenseAdjustmentKind;
  originalTransactionId: string;
  originalTitle: string | null;
  originalCategoryName: string | null;
}
