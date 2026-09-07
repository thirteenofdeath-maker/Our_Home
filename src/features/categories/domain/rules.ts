import type { CategoryTransactionType } from "@/types/database";

export interface CategoryForValidation {
  id: string;
  transactionType: CategoryTransactionType;
  archivedAt: string | null;
}

export class CategoryNotUsableError extends Error {}

/**
 * Pure mirror of the checks `create_income_expense_transaction` performs in
 * Postgres before it will attach a category to a new transaction (see
 * supabase/migrations/0010_functions_rpc.sql). Used both to fail fast in
 * the UI before round-tripping to the server, and as a documented, unit-
 * tested statement of the rule: an archived category can never be attached
 * to a *new* transaction, but nothing about archiving touches transactions
 * that already reference it (see docs/DOMAIN_RULES.md).
 */
export function assertCategoryUsableForNewTransaction(
  category: CategoryForValidation,
  transactionType: "INCOME" | "EXPENSE",
): void {
  if (category.archivedAt !== null) {
    throw new CategoryNotUsableError(`Category ${category.id} is archived and cannot be used for new transactions`);
  }
  if (category.transactionType !== transactionType) {
    throw new CategoryNotUsableError(
      `Category ${category.id} is a ${category.transactionType} category and cannot be used for a ${transactionType} transaction`,
    );
  }
}
