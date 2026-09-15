import { describe, expect, it } from "vitest";

import { buildNetWorthDashboard } from "./domain";

describe("net-worth classification", () => {
  it("moves credit-card balances to liabilities and keeps cash as assets", () => {
    const [summary] = buildNetWorthDashboard(
      [
        {
          walletId: "wallet-bank",
          walletName: "KBank",
          pocketId: "bank",
          pocketName: "Main",
          pocketType: "BANK",
          currency: "THB",
          balance: "100.00",
          archived: false,
        },
        {
          walletId: "wallet-card",
          walletName: "Cards",
          pocketId: "card",
          pocketName: "Visa",
          pocketType: "CREDIT_CARD",
          currency: "THB",
          balance: "-80.00",
          archived: false,
        },
      ],
      [{ pocketId: "card", liability: "80.00", cardCredit: "0.00" }],
      [
        {
          id: "receivable",
          name: "เพื่อนยืม",
          counterparty: "A",
          debtType: "RECEIVABLE",
          currency: "THB",
          outstanding: "20.00",
          archived: false,
        },
        {
          id: "debt",
          name: "ยืมมา",
          counterparty: "B",
          debtType: "LIABILITY",
          currency: "THB",
          outstanding: "5.00",
          archived: false,
        },
      ],
    );

    expect(summary.assetTotal).toBe("120.00");
    expect(summary.liabilityTotal).toBe("85.00");
    expect(summary.netWorth).toBe("35.00");
    expect(summary.assets.map((row) => row.kind)).toEqual([
      "BANK",
      "RECEIVABLE",
    ]);
    expect(summary.liabilities.map((row) => row.kind)).toEqual([
      "CREDIT_CARD",
      "DEBT",
    ]);
  });

  it("treats an overpaid card as an asset without creating negative liability", () => {
    const [summary] = buildNetWorthDashboard(
      [
        {
          walletId: "wallet-card",
          walletName: "Cards",
          pocketId: "card",
          pocketName: "Visa",
          pocketType: "CREDIT_CARD",
          currency: "THB",
          balance: "25.00",
          archived: true,
        },
      ],
      [{ pocketId: "card", liability: "0.00", cardCredit: "25.00" }],
      [],
    );

    expect(summary.assetTotal).toBe("25.00");
    expect(summary.liabilityTotal).toBe("0.00");
    expect(summary.netWorth).toBe("25.00");
    expect(summary.assets[0]).toMatchObject({
      kind: "CARD_CREDIT",
      archived: true,
    });
    expect(summary.liabilities[0]).toMatchObject({
      kind: "CREDIT_CARD",
      amount: "0.00",
    });
  });

  it("classifies a negative non-card balance as a liability", () => {
    const [summary] = buildNetWorthDashboard(
      [
        {
          walletId: "wallet",
          walletName: "Wallet",
          pocketId: "pocket",
          pocketName: "Overdraft",
          pocketType: "BANK",
          currency: "USD",
          balance: "-12.34",
          archived: false,
        },
      ],
      [],
      [],
    );

    expect(summary.assetTotal).toBe("0.00");
    expect(summary.liabilityTotal).toBe("12.34");
    expect(summary.netWorth).toBe("-12.34");
  });
});
