import { describe, expect, it } from "vitest";

import {
  buildIncomeExpenseEntries,
  buildPocketTransferEntries,
  buildWalletTransferEntries,
  netWorth,
  pocketBalance,
  sumAmounts,
  walletBalance,
} from "./ledger";

describe("sumAmounts (decimal-safe, no floating point)", () => {
  it("adds decimals exactly, unlike IEEE 754 floats", () => {
    // 0.1 + 0.2 === 0.30000000000000004 in JS floats. Our ledger must not do that.
    expect(sumAmounts(["0.10", "0.20"])).toBe("0.30");
  });

  it("sums mixed-sign amounts to a net-zero transfer", () => {
    expect(sumAmounts(["-2000.00", "2000.00"])).toBe("0.00");
  });
});

describe("Income 1000 -> pocket +1000, wallet +1000", () => {
  it("produces a single positive entry", () => {
    const entries = buildIncomeExpenseEntries({
      transactionType: "INCOME",
      walletId: "kbank",
      pocketId: "main",
      amount: "1000.00",
    });

    expect(pocketBalance(entries, "main")).toBe("1000.00");
    expect(walletBalance(entries, "kbank")).toBe("1000.00");
  });
});

describe("Expense 200 -> pocket -200, wallet -200", () => {
  it("produces a single negative entry", () => {
    const entries = buildIncomeExpenseEntries({
      transactionType: "EXPENSE",
      walletId: "kbank",
      pocketId: "food",
      amount: "200.00",
    });

    expect(pocketBalance(entries, "food")).toBe("-200.00");
    expect(walletBalance(entries, "kbank")).toBe("-200.00");
  });
});

describe("Pocket transfer 300 Main -> Food", () => {
  it("moves balance between pockets but leaves the wallet total unchanged", () => {
    const opening: import("./ledger").LedgerEntry[] = [
      { walletId: "kbank", pocketId: "main", amount: "1000.00" },
    ];
    const transfer = buildPocketTransferEntries({
      walletId: "kbank",
      fromPocketId: "main",
      toPocketId: "food",
      amount: "300.00",
    });
    const entries = [...opening, ...transfer];

    expect(pocketBalance(entries, "main")).toBe("700.00");
    expect(pocketBalance(entries, "food")).toBe("300.00");
    expect(walletBalance(entries, "kbank")).toBe("1000.00"); // unchanged
  });
});

describe("Wallet transfer 500 KBank -> SCB", () => {
  it("moves balance between wallets but leaves total net worth unchanged", () => {
    const opening: import("./ledger").LedgerEntry[] = [
      { walletId: "kbank", pocketId: "kbank-main", amount: "1000.00" },
      { walletId: "scb", pocketId: "scb-main", amount: "500.00" },
    ];
    const transfer = buildWalletTransferEntries({
      fromWalletId: "kbank",
      fromPocketId: "kbank-main",
      toWalletId: "scb",
      toPocketId: "scb-main",
      amount: "500.00",
    });
    const entries = [...opening, ...transfer];

    expect(walletBalance(entries, "kbank")).toBe("500.00");
    expect(walletBalance(entries, "scb")).toBe("1000.00");
    expect(netWorth(entries)).toBe(netWorth(opening)); // unchanged overall
    expect(netWorth(entries)).toBe("1500.00");
  });

  it("never persists only one side: the two entries always sum to exactly zero", () => {
    const transfer = buildWalletTransferEntries({
      fromWalletId: "kbank",
      fromPocketId: "kbank-main",
      toWalletId: "scb",
      toPocketId: "scb-main",
      amount: "500.00",
    });

    expect(netWorth(transfer)).toBe("0.00");
  });
});
