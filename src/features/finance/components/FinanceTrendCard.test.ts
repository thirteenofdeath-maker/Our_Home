import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FinanceTrendCard } from "./FinanceTrendCard";

describe("FinanceTrendCard", () => {
  it("renders this currency's income/expense/net using formatCurrency, never a raw computed number", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceTrendCard, {
        currency: "THB",
        showCurrencyLabel: false,
        trend: [{ month: "2026-09", income: "1000.00", expense: "400.00" }],
        income: "1000.00",
        expense: "400.00",
        net: "600.00",
      }),
    );
    expect(html).toContain("฿1,000.00");
    expect(html).toContain("฿400.00");
    expect(html).toContain("฿600.00");
  });

  it("shows the currency label only when the caller says there is more than one currency", () => {
    const single = renderToStaticMarkup(
      createElement(FinanceTrendCard, { currency: "THB", showCurrencyLabel: false, trend: [], income: "0.00", expense: "0.00", net: "0.00" }),
    );
    const multi = renderToStaticMarkup(
      createElement(FinanceTrendCard, { currency: "USD", showCurrencyLabel: true, trend: [], income: "0.00", expense: "0.00", net: "0.00" }),
    );
    expect(single).not.toContain("THB");
    expect(multi).toContain("USD");
  });

  it("marks a negative net (spent more than earned) without clamping it to zero", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceTrendCard, { currency: "THB", showCurrencyLabel: false, trend: [], income: "100.00", expense: "500.00", net: "-400.00" }),
    );
    expect(html).toContain("-฿400.00");
  });

  // Regression for the real-device bug: a tall, visually empty chart
  // despite correct data (฿30/฿100/฿70 all rendering below it). Root
  // cause was a percentage-height bar whose direct parent had no
  // definite height (an `auto`-height flex column), which the CSS spec
  // resolves to 0 regardless of the requested percentage. Every bar's
  // DIRECT parent must carry an explicit height class for the chart to
  // ever be able to show anything.
  it("gives every bar's direct parent an explicit height, so percentage heights can resolve to something other than zero", () => {
    const trend = [
      { month: "2026-08", income: "50.00", expense: "20.00" },
      { month: "2026-09", income: "100.00", expense: "30.00" },
    ];
    const html = renderToStaticMarkup(
      createElement(FinanceTrendCard, { currency: "THB", showCurrencyLabel: false, trend, income: "100.00", expense: "30.00", net: "70.00" }),
    );
    // The chart's own fixed pixel height, within the requested 150-190px band.
    expect(html).toContain('class="mt-3 flex h-40 gap-1.5" aria-hidden="true"');
    // Every column (one per trend point) must carry an explicit height —
    // `h-full`, inherited from the chart's own `h-40` — or a percentage
    // height on the bar inside it computes to 0 per the CSS spec,
    // regardless of the value actually requested in its inline style.
    const columnMatches = html.match(/class="flex h-full flex-1 items-end gap-0\.5"/g) ?? [];
    expect(columnMatches).toHaveLength(trend.length);
    // And every bar still carries its real, non-zero percentage.
    expect(html).toMatch(/style="height:\d+(\.\d+)?%"/);
    expect(html).not.toContain('style="height:0%"');
  });

  it("never renders the full-size chart container for a genuinely empty trend — a small labeled placeholder instead", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceTrendCard, { currency: "THB", showCurrencyLabel: false, trend: [], income: "0.00", expense: "0.00", net: "0.00" }),
    );
    expect(html).toContain("ยังไม่มีข้อมูลแนวโน้ม");
    expect(html).not.toContain("h-40");
    expect(html).not.toContain('aria-hidden="true"');
  });

  // Regression for a real-device presentation bug: the summary row below
  // the chart reads left-to-right as Expense -> Income -> Net, but each
  // month's bar pair rendered Income first (left) then Expense (right) —
  // a red/green swap that made the chart visually contradict its own
  // numbers underneath it (a tall green bar on the left, red on the
  // right, while "รายจ่ายรวม" — expense — was the LEFT summary label).
  it("orders each column's bars Expense (left) then Income (right), matching the Expense -> Income -> Net summary row below", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceTrendCard, {
        currency: "THB",
        showCurrencyLabel: false,
        trend: [{ month: "2026-09", income: "100.00", expense: "30.00" }],
        income: "100.00",
        expense: "30.00",
        net: "70.00",
      }),
    );
    const expenseBarIdx = html.indexOf('data-series="expense"');
    const incomeBarIdx = html.indexOf('data-series="income"');
    expect(expenseBarIdx).toBeGreaterThan(-1);
    expect(incomeBarIdx).toBeGreaterThan(-1);
    expect(expenseBarIdx).toBeLessThan(incomeBarIdx);

    // And the summary row underneath is genuinely Expense -> Income -> Net,
    // left to right, which is the order the bars above must match.
    const expenseLabelIdx = html.indexOf("รายจ่ายรวม");
    const incomeLabelIdx = html.indexOf("รายรับรวม");
    const netLabelIdx = html.indexOf("คงเหลือ");
    expect(expenseLabelIdx).toBeLessThan(incomeLabelIdx);
    expect(incomeLabelIdx).toBeLessThan(netLabelIdx);

    // The expense bar is colored as expense (coral), the income bar as
    // income (green) — never swapped.
    const expenseBarTag = html.match(/<div data-series="expense"[^>]*>/)?.[0] ?? "";
    const incomeBarTag = html.match(/<div data-series="income"[^>]*>/)?.[0] ?? "";
    expect(expenseBarTag).toContain("bg-finance-expense");
    expect(incomeBarTag).toContain("bg-finance-income");
  });

  it("visually emphasizes the current (last) month over earlier ones", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceTrendCard, {
        currency: "THB",
        showCurrencyLabel: false,
        trend: [
          { month: "2026-08", income: "100.00", expense: "40.00" },
          { month: "2026-09", income: "100.00", expense: "40.00" },
        ],
        income: "100.00",
        expense: "40.00",
        net: "60.00",
      }),
    );
    expect(html).toContain("bg-finance-income\"");
    expect(html).toContain("bg-finance-income/40\"");
  });
});
