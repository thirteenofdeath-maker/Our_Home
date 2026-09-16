import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildSeriesPath, FinanceTrendCard } from "./FinanceTrendCard";

const render = (overrides: Partial<Parameters<typeof FinanceTrendCard>[0]> = {}) =>
  renderToStaticMarkup(createElement(FinanceTrendCard, {
    currency: "THB",
    showCurrencyLabel: false,
    trend: [
      { month: "2026-08", income: "500.00", expense: "200.00" },
      { month: "2026-09", income: "1000.00", expense: "400.00" },
    ],
    income: "1000.00",
    expense: "400.00",
    net: "600.00",
    ...overrides,
  }));

describe("FinanceTrendCard", () => {
  it("renders an accessible two-series income and expense overview", () => {
    const html = render();
    expect(html).toContain("ภาพรวมรายรับ–รายจ่าย");
    expect(html).toContain('role="img"');
    expect(html).toContain('data-series="income"');
    expect(html).toContain('data-series="expense"');
    expect(html).toContain("฿1,000.00");
    expect(html).toContain("฿400.00");
    expect(html).toContain("฿600.00");
  });

  it("creates a stable path and keeps larger values higher in the chart", () => {
    const path = buildSeriesPath([0, 50, 100], 100);
    expect(path).toBe("M0.00 112.00 L160.00 62.00 L320.00 12.00");
  });

  it("shows the currency label only for a multi-currency dashboard", () => {
    expect(render({ trend: [], showCurrencyLabel: false })).not.toContain("THB");
    expect(render({ trend: [], currency: "USD", showCurrencyLabel: true })).toContain("USD");
  });

  it("keeps negative balance visible and provides an honest empty state", () => {
    const negative = render({ trend: [], income: "100.00", expense: "500.00", net: "-400.00" });
    expect(negative).toContain("-฿400.00");
    expect(negative).toContain("ยังไม่มีข้อมูลรายรับ–รายจ่าย");
    expect(negative).not.toContain('role="img"');
  });

  it("keeps the line chart visible when the six-month series contains only zeroes", () => {
    const html = render({
      trend: [
        { month: "2026-08", income: "0.00", expense: "0.00" },
        { month: "2026-09", income: "0.00", expense: "0.00" },
      ],
    });
    expect(html).toContain('role="img"');
    expect(html).toContain("ยังไม่มีรายการในช่วงนี้");
    expect(html).toContain('stroke-dasharray="7 4"');
  });
});
