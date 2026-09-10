import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GlobalQuickAdd, QuickAddChoices } from "./GlobalQuickAdd";

describe("global quick add", () => {
  it("opens choices with selected wallet and remains accessible", () => {
    const html = renderToStaticMarkup(createElement(GlobalQuickAdd, { walletId: "w1" }));
    expect(html).toContain("/finance/quick-add?walletId=w1");
    expect(html).toContain('aria-label="เพิ่มรายการการเงิน"');
    expect(html).toContain("size-14");
    expect(html).toContain("left-1/2");
    expect(html).toContain("safe-area-inset-bottom");
  });
  it("reuses existing Income Expense and Transfer routes", () => {
    const html = renderToStaticMarkup(createElement(QuickAddChoices, { walletId: "w1" }));
    expect(html).toContain("/wallets/w1/transactions/new?type=INCOME");
    expect(html).toContain("/wallets/w1/transactions/new?type=EXPENSE");
    expect(html).toContain("/wallets/w1/transfer");
  });
  it("sends walletless users to wallet creation", () => {
    expect(renderToStaticMarkup(createElement(GlobalQuickAdd, { walletId: null }))).toContain('href="/wallets/new"');
  });
});
