import { describe, expect, it } from "vitest";

import { budgetProgressPercent, budgetStatus, type BudgetSummaryItem } from "./types";

function item(overrides: Partial<Pick<BudgetSummaryItem, "budgetAmount" | "netSpent">>) {
  return { budgetAmount: "5000.00", netSpent: "0.00", ...overrides };
}

describe("budgetStatus (derived UI state — never stored)", () => {
  it("is UNDER below 80%", () => {
    expect(budgetStatus(item({ netSpent: "3200.00" }))).toBe("UNDER");
  });

  it("is NEAR_LIMIT from 80% up to (not including) 100%", () => {
    expect(budgetStatus(item({ netSpent: "4000.00" }))).toBe("NEAR_LIMIT");
    expect(budgetStatus(item({ netSpent: "4999.99" }))).toBe("NEAR_LIMIT");
  });

  it("is OVER at or beyond 100%", () => {
    expect(budgetStatus(item({ netSpent: "5000.00" }))).toBe("OVER");
    expect(budgetStatus(item({ netSpent: "6200.00" }))).toBe("OVER");
  });

  it("is UNDER for a negative net_spent (a cash-basis month dominated by refunds)", () => {
    expect(budgetStatus(item({ netSpent: "-400.00" }))).toBe("UNDER");
  });
});

describe("budgetProgressPercent (visual-only clamp — never touches the authoritative net_spent/remaining)", () => {
  it("computes the plain ratio within [0, 100]", () => {
    expect(budgetProgressPercent(item({ netSpent: "3200.00" }))).toBeCloseTo(64, 5);
  });

  it("clamps a negative net_spent to 0%, not a negative bar", () => {
    expect(budgetProgressPercent(item({ netSpent: "-400.00" }))).toBe(0);
  });

  it("clamps an over-budget spend to 100%, not beyond", () => {
    expect(budgetProgressPercent(item({ netSpent: "9000.00" }))).toBe(100);
  });
});
