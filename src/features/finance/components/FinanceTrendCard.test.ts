import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildSeriesPath, FinanceTrendCard } from "./FinanceTrendCard";
import { buildCumulativeDailyTrend } from "../domain/finance-trend";

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
      comparisonTrend: [
        { date: "2026-08-01", income: "300.00", expense: "100.00" },
        { date: "2026-08-02", income: "600.00", expense: "300.00" },
      ],
      monthLabel: "กันยายน",
      comparisonMonthLabel: "สิงหาคม",
      income: "1000.00",
      expense: "400.00",
      previousIncome: "600.00",
      previousExpense: "300.00",
      ...overrides,
    }),
  );

describe("FinanceTrendCard", () => {
  it("renders an accessible current-versus-previous-month expense comparison", () => {
    const html = render();
    expect(html).toContain("แนวโน้ม");
    expect(html).toContain('aria-label="เลือกประเภทแนวโน้ม"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('role="img"');
    expect(html).toContain('data-series="current-expense"');
    expect(html).toContain('data-series="previous-expense"');
    expect(html).toContain("฿400.00");
    expect(html).toContain("฿300.00");
    expect(html).toContain("+฿100.00");
    expect(html).toContain("รายจ่ายเพิ่มขึ้น ฿100.00 จากเดือนก่อน");
  });

  it("creates a stable path and keeps larger values higher in the chart", () => {
    const path = buildSeriesPath([0, 50, 100], 100);
    expect(path).toBe("M0.00 112.00 L160.00 62.00 L320.00 12.00");
  });

  it("stops a partial current-month path at its matching day slot", () => {
    expect(buildSeriesPath([0, 50], 100, 3)).toBe("M0.00 112.00 L160.00 62.00");
  });

  it("shows the currency label only for a multi-currency dashboard", () => {
    expect(render({ trend: [], showCurrencyLabel: false })).not.toContain(
      "THB",
    );
    expect(
      render({ trend: [], currency: "USD", showCurrencyLabel: true }),
    ).toContain("USD");
  });

  it("shows a decrease and provides an honest empty state", () => {
    const decreased = render({
      trend: [],
      comparisonTrend: [],
      income: "100.00",
      expense: "300.00",
      previousExpense: "500.00",
    });
    expect(decreased).toContain("รายจ่ายลดลง ฿200.00 จากเดือนก่อน");
    expect(decreased).toContain("ยังไม่มีข้อมูลรายจ่ายสำหรับเปรียบเทียบ");
    expect(decreased).not.toContain('role="img"');
  });

  it("keeps the line chart visible when the six-month series contains only zeroes", () => {
    const html = render({
      trend: [
        { date: "2026-09-01", income: "0.00", expense: "0.00" },
        { date: "2026-09-02", income: "0.00", expense: "0.00" },
      ],
      comparisonTrend: [
        { date: "2026-08-01", income: "0.00", expense: "0.00" },
        { date: "2026-08-02", income: "0.00", expense: "0.00" },
      ],
    });
    expect(html).toContain('role="img"');
    expect(html).toContain("ยังไม่มีรายการในช่วงนี้");
    expect(html).not.toContain('stroke-dasharray="7 4"');
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
