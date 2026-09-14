import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ExpenseScopeSelect } from "./ExpenseScopeSelect";

describe("ExpenseScopeSelect (Phase U / 0051)", () => {
  it("renders both options with neither preselected when value is null", () => {
    const html = renderToStaticMarkup(createElement(ExpenseScopeSelect, { value: null, onChange: vi.fn() }));
    expect(html).toContain("ส่วนตัว");
    expect(html).toContain("ครอบครัว");
    expect(html).toContain('value=""');
    expect(html).not.toContain("border-2 border-primary bg-primary-soft");
    expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain('aria-checked="true"');
  });

  it("marks the chosen option aria-checked and reflects it in the hidden field", () => {
    const html = renderToStaticMarkup(createElement(ExpenseScopeSelect, { value: "HOUSEHOLD", onChange: vi.fn() }));
    expect(html).toContain('name="expenseScope" value="HOUSEHOLD"');
    expect(html).toContain('aria-checked="true"');
  });
});
