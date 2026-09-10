import { describe, expect, it } from "vitest";

import {
  financeExpenseHref,
  financeIncomeHref,
  financeMonthRange,
  financeMonthToPeriodMonth,
  financeTransferHref,
  mapFinanceSummaryWire,
  mapRecentFinanceTransactions,
  nextLocalDate,
  positiveMoney,
  shiftFinanceMonth,
  type FinanceEntryRow,
  type FinanceTransactionRow,
} from "./finance";

describe("shiftFinanceMonth (Budget month navigation)", () => {
  it("moves forward and backward within a year", () => {
    expect(shiftFinanceMonth("2026-09", 1)).toBe("2026-10");
    expect(shiftFinanceMonth("2026-09", -1)).toBe("2026-08");
  });

  it("rolls over a year boundary in both directions", () => {
    expect(shiftFinanceMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftFinanceMonth("2026-01", -1)).toBe("2025-12");
  });

  it("rejects a malformed month", () => {
    expect(() => shiftFinanceMonth("2026-9", 1)).toThrow(TypeError);
  });
});

describe("financeMonthToPeriodMonth (canonical first-of-month for budgets.period_month)", () => {
  it("appends the canonical day", () => {
    expect(financeMonthToPeriodMonth("2026-09")).toBe("2026-09-01");
  });

  it("rejects a malformed month", () => {
    expect(() => financeMonthToPeriodMonth("2026-9")).toThrow(TypeError);
  });
});

describe("nextLocalDate (search date-range exclusive upper bound)", () => {
  it("advances one calendar day", () => {
    expect(nextLocalDate("2026-09-10")).toBe("2026-09-11");
  });

  it("rolls over a month boundary", () => {
    expect(nextLocalDate("2026-09-30")).toBe("2026-10-01");
  });

  it("rolls over a year boundary", () => {
    expect(nextLocalDate("2026-12-31")).toBe("2027-01-01");
  });

  it("rejects a malformed date", () => {
    expect(() => nextLocalDate("2026-9-1")).toThrow(TypeError);
  });
});

describe("financeMonthRange", () => {
  it("produces a Bangkok-anchored [start, end) range spanning exactly one month", () => {
    const range = financeMonthRange("2026-02");
    expect(range.start).toBe("2026-02-01T00:00:00+07:00");
    expect(range.end).toBe("2026-03-01T00:00:00+07:00");
  });

  it("rolls over the year at December", () => {
    const range = financeMonthRange("2026-12");
    expect(range.end).toBe("2027-01-01T00:00:00+07:00");
  });

  it("rejects a malformed month", () => {
    expect(() => financeMonthRange("2026-2")).toThrow(TypeError);
  });
});

describe("positiveMoney", () => {
  it("strips a leading sign without touching the magnitude", () => {
    expect(positiveMoney("-120.50")).toBe("120.50");
    expect(positiveMoney("120.50")).toBe("120.50");
  });
});

describe("mapFinanceSummaryWire: currency safety (requirement: never sum different currencies)", () => {
  it("keeps month income/expense as separate per-currency entries, never combined into one figure", () => {
    const summary = mapFinanceSummaryWire({
      month_totals: [
        { currency: "THB", income: "25000", expense: "4200" },
        { currency: "USD", income: "0", expense: "120" },
      ],
    });

    expect(summary.monthTotals).toEqual([
      { currency: "THB", income: "25000.00", expense: "4200.00" },
      { currency: "USD", income: "0.00", expense: "120.00" },
    ]);
    // There is no single combined figure anywhere in the mapped shape —
    // asserting the exact per-currency array above already proves this,
    // but spelled out: THB and USD numbers never appear added together.
  });

  it("keeps wallet balances and their currency totals grouped by currency", () => {
    const summary = mapFinanceSummaryWire({
      wallet_balances: [
        { wallet_id: "w1", currency: "THB", amount: "25000" },
        { wallet_id: "w2", currency: "USD", amount: "120" },
      ],
      currency_totals: [
        { currency: "THB", amount: "25000" },
        { currency: "USD", amount: "120" },
      ],
    });

    expect(summary.currencyTotals).toEqual([
      { currency: "THB", amount: "25000.00" },
      { currency: "USD", amount: "120.00" },
    ]);
  });

  it("keeps same-name expense categories in different currencies as separate rows", () => {
    const summary = mapFinanceSummaryWire({
      category_totals: [
        { category_id: "c1", name: "อาหาร", currency: "THB", amount: "4200" },
        { category_id: "c1", name: "อาหาร", currency: "USD", amount: "30" },
      ],
    });

    expect(summary.categoryTotals).toEqual([
      { categoryId: "c1", name: "อาหาร", currency: "THB", amount: "4200.00" },
      { categoryId: "c1", name: "อาหาร", currency: "USD", amount: "30.00" },
    ]);
  });

  it("defaults every array to empty rather than throwing when the RPC returns a partial shape", () => {
    expect(mapFinanceSummaryWire({})).toEqual({
      walletBalances: [],
      currencyTotals: [],
      monthTotals: [],
      categoryTotals: [],
    });
  });
});

function txn(overrides: Partial<FinanceTransactionRow>): FinanceTransactionRow {
  return {
    id: "t1",
    transaction_type: "EXPENSE",
    title: null,
    note: null,
    occurred_at: "2026-02-10T00:00:00Z",
    category: null,
    creator: null,
    ...overrides,
  };
}

function entry(overrides: Partial<FinanceEntryRow>): FinanceEntryRow {
  return {
    transaction_id: "t1",
    amount: "-120.00",
    wallet_id: "w1",
    wallet: { name: "KBank", currency: "THB" },
    pocket: { name: "Food" },
    ...overrides,
  };
}

describe("mapRecentFinanceTransactions", () => {
  it("passes an EXPENSE through as a single negative-amount row", () => {
    const result = mapRecentFinanceTransactions(
      [txn({ id: "t1", transaction_type: "EXPENSE", category: { name: "Coffee" } })],
      [entry({ transaction_id: "t1", amount: "-120.00" })],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ transactionId: "t1", transactionType: "EXPENSE", amount: "-120.00", categoryName: "Coffee" });
    expect(result[0].pocketTransfer).toBeUndefined();
    expect(result[0].walletTransfer).toBeUndefined();
  });

  it("passes an INCOME through as a single positive-amount row", () => {
    const result = mapRecentFinanceTransactions(
      [txn({ id: "t2", transaction_type: "INCOME" })],
      [entry({ transaction_id: "t2", amount: "35000.00" })],
    );

    expect(result[0]).toMatchObject({ transactionId: "t2", transactionType: "INCOME", amount: "35000.00" });
  });

  it("groups a pocket transfer's two entries (same wallet) into ONE logical row", () => {
    const result = mapRecentFinanceTransactions(
      [txn({ id: "t3", transaction_type: "TRANSFER" })],
      [
        entry({ transaction_id: "t3", wallet_id: "w1", amount: "-2000.00", pocket: { name: "Main" } }),
        entry({ transaction_id: "t3", wallet_id: "w1", amount: "2000.00", pocket: { name: "Travel" } }),
      ],
    );

    expect(result).toHaveLength(1);
    expect(result[0].pocketTransfer).toEqual({ fromPocketName: "Main", toPocketName: "Travel", amount: "2000.00" });
    expect(result[0].walletTransfer).toBeUndefined();
  });

  it("groups a wallet transfer's two entries (different wallets) into ONE logical row", () => {
    const result = mapRecentFinanceTransactions(
      [txn({ id: "t4", transaction_type: "TRANSFER" })],
      [
        entry({ transaction_id: "t4", wallet_id: "w1", amount: "-3000.00", wallet: { name: "KBank", currency: "THB" }, pocket: { name: "Main" } }),
        entry({ transaction_id: "t4", wallet_id: "w2", amount: "3000.00", wallet: { name: "SCB", currency: "THB" }, pocket: { name: "Main" } }),
      ],
    );

    expect(result).toHaveLength(1);
    expect(result[0].walletTransfer).toEqual({
      fromWalletName: "KBank",
      fromPocketName: "Main",
      toWalletName: "SCB",
      toPocketName: "Main",
    });
    expect(result[0].pocketTransfer).toBeUndefined();
  });

  it("never emits more rows than transactions (one row per transaction_id, not per ledger entry)", () => {
    const transactions = [txn({ id: "t5", transaction_type: "TRANSFER" }), txn({ id: "t6", transaction_type: "EXPENSE" })];
    const entries = [
      entry({ transaction_id: "t5", wallet_id: "w1", amount: "-500.00" }),
      entry({ transaction_id: "t5", wallet_id: "w1", amount: "500.00" }),
      entry({ transaction_id: "t6", amount: "-90.00" }),
    ];

    const result = mapRecentFinanceTransactions(transactions, entries);
    expect(result.map((r) => r.transactionId).sort()).toEqual(["t5", "t6"]);
  });

  it("drops a transaction with no matching entries instead of producing a broken row", () => {
    const result = mapRecentFinanceTransactions([txn({ id: "orphan" })], []);
    expect(result).toEqual([]);
  });
});

describe("Quick-add links reach the existing, already-verified creation flows", () => {
  it("routes Income to the existing wallet income form with Finance as the return target", () => {
    expect(financeIncomeHref("wallet-1")).toBe("/wallets/wallet-1/transactions/new?type=INCOME&returnTo=%2Ffinance");
  });

  it("routes Expense to the existing wallet expense form with Finance as the return target", () => {
    expect(financeExpenseHref("wallet-1")).toBe("/wallets/wallet-1/transactions/new?type=EXPENSE&returnTo=%2Ffinance");
  });

  it("routes Transfer to the existing transfer chooser", () => {
    expect(financeTransferHref("wallet-1")).toBe("/wallets/wallet-1/transfer");
  });
});
