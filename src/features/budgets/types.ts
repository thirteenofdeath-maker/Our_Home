import type { Database } from "@/types/database";

export type Budget = Database["public"]["Tables"]["budgets"]["Row"];

/**
 * One row from get_budget_summary (0034) — every figure a decimal
 * string, `netSpent`/`remaining` derived live, never stored, and never
 * clamped (a cash-basis month dominated by refunds can legitimately show
 * a negative netSpent — see docs/FINANCE.md Phase E).
 */
export interface BudgetSummaryItem {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  categoryArchived: boolean;
  currency: string;
  periodMonth: string;
  budgetAmount: string;
  netSpent: string;
  remaining: string;
  archivedAt: string | null;
}

export type BudgetStatus = "UNDER" | "NEAR_LIMIT" | "OVER";

/**
 * Derived UI state only — never stored, never authoritative. Percentage
 * used for the progress bar is clamped to [0, 100]; the underlying
 * netSpent/remaining figures the caller already has are never touched.
 */
export function budgetStatus(item: Pick<BudgetSummaryItem, "budgetAmount" | "netSpent">): BudgetStatus {
  const ratio = Number(item.netSpent) / Number(item.budgetAmount);
  if (ratio >= 1) return "OVER";
  if (ratio >= 0.8) return "NEAR_LIMIT";
  return "UNDER";
}

export function budgetProgressPercent(item: Pick<BudgetSummaryItem, "budgetAmount" | "netSpent">): number {
  const ratio = Number(item.netSpent) / Number(item.budgetAmount);
  return Math.max(0, Math.min(100, ratio * 100));
}
