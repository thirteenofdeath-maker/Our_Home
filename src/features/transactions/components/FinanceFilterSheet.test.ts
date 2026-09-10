import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FinanceFilterSheet } from "./FinanceFilterSheet";

describe("FinanceFilterSheet", () => {
  it("renders the trigger and passes the filter form through as children unchanged", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceFilterSheet, { active: false }, createElement("form", { "data-testid": "filter-form" }, "form contents")),
    );
    expect(html).toContain('aria-label="ตัวกรอง"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('data-testid="filter-form"');
    expect(html).toContain("form contents");
  });

  it("shows an active-filter indicator only when a filter is actually applied", () => {
    const inactive = renderToStaticMarkup(createElement(FinanceFilterSheet, { active: false }, "x"));
    const active = renderToStaticMarkup(createElement(FinanceFilterSheet, { active: true }, "x"));
    expect(inactive).not.toContain("bg-finance-expense");
    expect(active).toContain("bg-finance-expense");
  });

  it("the trigger is a plain button, not a link or form submit — opening/closing is local UI state, never a navigation or a transaction search param change", () => {
    const html = renderToStaticMarkup(createElement(FinanceFilterSheet, { active: false }, "x"));
    const triggerButton = html.match(/<button[^>]*aria-label="ตัวกรอง"[^>]*>/)?.[0] ?? "";
    expect(triggerButton).toContain('type="button"');
    expect(triggerButton).not.toContain("href");
    expect(triggerButton).not.toContain('type="submit"');
  });
});
