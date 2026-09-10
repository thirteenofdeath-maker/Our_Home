import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { TransactionHistoryItem } from "../types";
import { TransactionHistoryList } from "./TransactionHistoryList";

function baseItem(overrides: Partial<TransactionHistoryItem> = {}): TransactionHistoryItem {
  return {
    transactionId: "t1",
    transactionType: "EXPENSE",
    title: "ร้านอาหาร",
    note: null,
    occurredAt: "2026-09-10T11:40:00.000Z",
    categoryName: "อาหาร",
    walletName: "MAKE",
    pocketName: "Cash Box",
    creatorName: null,
    amount: "-250.00",
    voidedAt: null,
    ...overrides,
  };
}

describe("TransactionHistoryList", () => {
  it("links every row to the transaction detail route with the real amount/currency", () => {
    const html = renderToStaticMarkup(createElement(TransactionHistoryList, { items: [baseItem()], currency: "THB" }));
    expect(html).toContain('href="/finance/transactions/t1"');
    expect(html).toContain("฿250.00");
  });

  it("preserves the REFUND/REIMBURSEMENT adjustment label", () => {
    const item = baseItem({ adjustment: { kind: "REFUND", originalTitle: "ค่าอาหาร" } });
    const html = renderToStaticMarkup(createElement(TransactionHistoryList, { items: [item] }));
    expect(html).toContain("คืนเงิน");
    expect(html).toContain("ค่าอาหาร");
  });

  it("preserves pocket-transfer and wallet-transfer context", () => {
    const pocket = baseItem({
      transactionType: "TRANSFER",
      pocketTransfer: { fromPocketName: "Cash", toPocketName: "Savings", amount: "100.00" },
      amount: "100.00",
    });
    const wallet = baseItem({
      transactionType: "TRANSFER",
      walletTransfer: { fromWalletName: "MAKE", fromPocketName: "Cash", toWalletName: "SCB", toPocketName: "Main" },
      amount: "100.00",
    });
    const html = renderToStaticMarkup(createElement(TransactionHistoryList, { items: [pocket, wallet] }));
    expect(html).toContain("Cash → Savings");
    expect(html).toContain("MAKE / Cash → SCB / Main");
    expect(html).toContain("โอนเงินระหว่างช่อง");
  });

  it("preserves the voided state visually and in text, without hiding the row", () => {
    const item = baseItem({ voidedAt: "2026-09-11T00:00:00.000Z" });
    const html = renderToStaticMarkup(createElement(TransactionHistoryList, { items: [item] }));
    expect(html).toContain("ยกเลิกแล้ว");
    expect(html).toContain("opacity-60");
    expect(html).toContain("text-finance-muted"); // muted icon/amount treatment, not the original type's color
  });

  it("preserves note and creator context", () => {
    const item = baseItem({ note: "มื้อเย็น", creatorName: "แม่" });
    const html = renderToStaticMarkup(createElement(TransactionHistoryList, { items: [item] }));
    expect(html).toContain("มื้อเย็น");
    expect(html).toContain("แม่");
  });

  it("wallet variant omits the wallet name from the context line (already implied)", () => {
    const item = baseItem();
    const walletVariant = renderToStaticMarkup(createElement(TransactionHistoryList, { items: [item], variant: "wallet" }));
    const fullVariant = renderToStaticMarkup(createElement(TransactionHistoryList, { items: [item], variant: "full" }));
    expect(walletVariant).not.toContain("MAKE / Cash Box");
    expect(walletVariant).toContain("Cash Box");
    expect(fullVariant).toContain("MAKE / Cash Box");
  });

  it("dashboard variant renders without a bordered/divided box", () => {
    const html = renderToStaticMarkup(createElement(TransactionHistoryList, { items: [baseItem()], variant: "dashboard" }));
    expect(html).not.toContain("divide-y");
  });

  it("shows an empty state instead of an empty list", () => {
    const html = renderToStaticMarkup(createElement(TransactionHistoryList, { items: [] }));
    expect(html).toContain("ยังไม่มีรายการ");
  });
});
