import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const transactionForms = [
  "src/features/transactions/components/TransactionForm.tsx",
  "src/features/transactions/components/EditTransactionForm.tsx",
  "src/features/transactions/components/UnifiedTransferForm.tsx",
  "src/features/transactions/components/WalletTransferForm.tsx",
  "src/features/transactions/components/PocketTransferForm.tsx",
  "src/features/credit-cards/components/CreditCardTransactionForm.tsx",
  "src/features/refunds/components/ExpenseAdjustmentForm.tsx",
  "src/features/bills/components/PayBillForm.tsx",
  "src/features/installments/components/PayInstallmentForm.tsx",
  "src/features/debts/components/DebtForms.tsx",
];

describe("finance transaction date and time fields", () => {
  it.each(transactionForms)("uses the shared date/time field in %s", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    expect(source).toContain("<FinanceOccurredAtField");
    expect(source).not.toMatch(
      /name=["']occurredAt["'][\s\S]{0,120}type=["']date["']/,
    );
  });

  it("submits one unambiguous local datetime value assembled from both controls", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/features/finance/components/FinanceOccurredAtField.tsx",
      ),
      "utf8",
    );
    expect(source).toContain('name="occurredAt"');
    expect(source).toContain('type="date"');
    expect(source).toContain('type="time"');
    expect(source).toContain("`${value.date}T${value.time}`");
  });

  it("adds date and time to all three debt transaction forms", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/features/debts/components/DebtForms.tsx"),
      "utf8",
    );
    expect(source.match(/<FinanceOccurredAtField/g)).toHaveLength(3);
  });
});
