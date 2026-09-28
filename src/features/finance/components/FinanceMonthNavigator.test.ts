import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import {
  financeMonthHref,
  FinanceMonthNavigator,
} from "./FinanceMonthNavigator";

describe("FinanceMonthNavigator", () => {
  it("keeps the finance scope while changing month", () => {
    expect(
      financeMonthHref("/finance", "2026-08", { scope: "HOUSEHOLD" }),
    ).toBe("/finance?scope=HOUSEHOLD&month=2026-08");
  });

  it("renders the same centered, clickable month control as planning", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceMonthNavigator, {
        month: "2026-09",
        label: "กันยายน 2569",
        previousMonth: "2026-08",
        nextMonth: "2026-10",
        currentMonth: "2026-09",
        pathname: "/finance",
        query: { scope: "HOUSEHOLD" },
      }),
    );

    expect(html).toContain('aria-label="เปลี่ยนเดือน"');
    expect(html).toContain('aria-label="เลือกเดือน"');
    expect(html).toContain('type="month"');
    expect(html).toContain("กันยายน 2569");
    expect(html).toContain("เดือนนี้");
    expect(html).toContain('href="/finance?scope=HOUSEHOLD&amp;month=2026-08"');
    expect(html).toContain('aria-current="date"');
  });
});
