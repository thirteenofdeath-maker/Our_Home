import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const transactionForms = [
  "src/features/transactions/components/TransactionForm.tsx",
  "src/features/transactions/components/EditTransactionForm.tsx",
  "src/features/transactions/components/PocketTransferForm.tsx",
  "src/features/transactions/components/WalletTransferForm.tsx",
  "src/features/transactions/components/UnifiedTransferForm.tsx",
  "src/features/credit-cards/components/CreditCardTransactionForm.tsx",
  "src/features/refunds/components/ExpenseAdjustmentForm.tsx",
  "src/features/bills/components/PayBillForm.tsx",
  "src/features/installments/components/PayInstallmentForm.tsx",
] as const;

describe("Finance transaction date and time", () => {
  it.each(transactionForms)("uses datetime-local in %s", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    expect(source).toContain('name="occurredAt"');
    expect(source).toContain('type="datetime-local"');
    expect(source).not.toMatch(
      /name="occurredAt"[\s\S]{0,120}type="date"|type="date"[\s\S]{0,120}name="occurredAt"/,
    );
  });

  it("does not force Finance transaction actions to noon", () => {
    const actionFiles = [
      "src/features/transactions/actions.ts",
      "src/features/credit-cards/actions.ts",
      "src/features/refunds/actions.ts",
      "src/features/recurring/actions.ts",
      "src/features/shopping/actions.ts",
      "src/features/bills/actions.ts",
      "src/features/installments/actions.ts",
    ];
    for (const file of actionFiles) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source).not.toContain("T12:00:00+07:00");
      expect(source).not.toContain("${value}T12:00:00");
    }
  });
});
