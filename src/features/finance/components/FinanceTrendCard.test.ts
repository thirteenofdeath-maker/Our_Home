import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  buildCumulativeDailyTrend,
  buildSeriesPath,
  FinanceTrendCard,
} from "./FinanceTrendCard";

const render = (
  overrides: Partial<Parameters<typeof FinanceTrendCard>[0]> = {},
) =>
  renderToStaticMarkup(
    createElement(FinanceTrendCard, {
      currency: "THB",
      showCurrencyLabel: false,
      trend: [
        { date: "2026-09-01", income: "500.00", expense: "200.00" },
        { date: "2026-09-02", income: "1000.00", expense: "400.00" },
      ],
      income: "1000.00",
      expense: "400.00",
      net: "600.00",
      ...overrides,
    }),
  );

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
    expect(render({ trend: [], showCurrencyLabel: false })).not.toContain(
      "THB",
    );
    expect(
      render({ trend: [], currency: "USD", showCurrencyLabel: true }),
    ).toContain("USD");
  });

  it("keeps negative balance visible and provides an honest empty state", () => {
    const negative = render({
      trend: [],
      income: "100.00",
      expense: "500.00",
      net: "-400.00",
    });
    expect(negative).toContain("-฿400.00");
    expect(negative).toContain("ยังไม่มีข้อมูลรายรับ–รายจ่าย");
    expect(negative).not.toContain('role="img"');
  });

  it("keeps the line chart visible when the six-month series contains only zeroes", () => {
    const html = render({
      trend: [
        { date: "2026-09-01", income: "0.00", expense: "0.00" },
        { date: "2026-09-02", income: "0.00", expense: "0.00" },
      ],
    });
    expect(html).toContain('role="img"');
    expect(html).toContain("ยังไม่มีรายการในช่วงนี้");
    expect(html).toContain('stroke-dasharray="7 4"');
  });

  it("builds a complete cumulative day-by-day series for the selected month", () => {
    const trend = buildCumulativeDailyTrend(
      "2026-09",
      [
        {
          date: "2026-09-01",
          currency: "THB",
          income: "100.00",
          expense: "0.00",
        },
        {
          date: "2026-09-03",
          currency: "THB",
          income: "50.00",
          expense: "20.00",
        },
        {
          date: "2026-09-03",
          currency: "USD",
          income: "900.00",
          expense: "900.00",
        },
      ],
      "THB",
    );
    expect(trend).toHaveLength(30);
    expect(trend[0]).toEqual({
      date: "2026-09-01",
      income: "100.00",
      expense: "0.00",
    });
    expect(trend[1]).toEqual({
      date: "2026-09-02",
      income: "100.00",
      expense: "0.00",
    });
    expect(trend[2]).toEqual({
      date: "2026-09-03",
      income: "150.00",
      expense: "20.00",
    });
    expect(trend[29]).toEqual({
      date: "2026-09-30",
      income: "150.00",
      expense: "20.00",
    });
  });
});
