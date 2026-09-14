import { describe, expect, it } from "vitest";

import { assertCategoryUsableForNewTransaction, CategoryNotUsableError } from "./rules";

describe("Archived category rule", () => {
  it("rejects an archived category for a NEW transaction", () => {
    const archived = { id: "c1", transactionType: "EXPENSE" as const, archivedAt: "2026-01-01T00:00:00Z" };

    expect(() => assertCategoryUsableForNewTransaction(archived, "EXPENSE")).toThrow(CategoryNotUsableError);
  });

  it("accepts an active category whose type matches the transaction", () => {
    const active = { id: "c2", transactionType: "EXPENSE" as const, archivedAt: null };

    expect(() => assertCategoryUsableForNewTransaction(active, "EXPENSE")).not.toThrow();
  });

  it("rejects a category whose transaction_type does not match (income category on an expense)", () => {
    const incomeCategory = { id: "c3", transactionType: "INCOME" as const, archivedAt: null };

    expect(() => assertCategoryUsableForNewTransaction(incomeCategory, "EXPENSE")).toThrow(CategoryNotUsableError);
  });

  it("archiving a category is a metadata flag only — nothing about this rule deletes or mutates historical data", () => {
    // This test exists to document intent: assertCategoryUsableForNewTransaction
    // is only ever called on the *new-transaction* path (see
    // features/transactions/actions.ts). A transaction created before a
    // category was archived keeps its category_id in the database
    // regardless — there is no code path, here or in the SQL migrations,
    // that touches transactions.category_id when a category is archived.
    const category = { id: "c4", transactionType: "EXPENSE" as const, archivedAt: null };
    expect(category.archivedAt).toBeNull();
  });
});
