import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { BudgetSummaryItem } from "../types";
import { BudgetCard } from "./BudgetCard";

const overBudget: BudgetSummaryItem = {
  budgetId: "b1",
  categoryId: "c1",
  categoryName: "อาหาร",
  categoryArchived: false,
  currency: "THB",
  periodMonth: "2026-09-01",
  budgetAmount: "1000.00",
  netSpent: "1200.30",
  remaining: "-200.30",
  archivedAt: null,
};

describe("BudgetCard", () => {
  it("computes the over-budget amount with exact decimal arithmetic, never JS floating point", () => {
    const html = renderToStaticMarkup(createElement(BudgetCard, { item: overBudget }));
    // 1200.30 - 1000.00 = 200.30 exactly.
    expect(html).toContain("฿200.30");
  });

  it("compact mode (Phase 1 /finance overview) never shows a period badge or currency label — pixel-identical to before", () => {
    const html = renderToStaticMarkup(createElement(BudgetCard, { item: overBudget, compact: true }));
    expect(html).not.toContain("2569"); // no Thai-year period badge
    expect(html).not.toContain(">THB<");
  });

  it("full mode (used on /finance/budgets) shows a period badge", () => {
    const html = renderToStaticMarkup(createElement(BudgetCard, { item: overBudget }));
    expect(html).toContain("2569"); // Buddhist-era year, ก.ย. 2569
  });
});
