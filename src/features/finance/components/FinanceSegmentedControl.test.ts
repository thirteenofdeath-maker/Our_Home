import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FinanceSegmentedControl } from "./FinanceSegmentedControl";

const options = [
  { value: "category", label: "หมวดหมู่", href: "?view=category" },
  { value: "month", label: "เดือน", href: "?view=month" },
  { value: "compare", label: "เปรียบเทียบ", href: "?view=compare" },
];

describe("FinanceSegmentedControl", () => {
  it("renders every option as a real link with a 44px touch target", () => {
    const html = renderToStaticMarkup(createElement(FinanceSegmentedControl, { options, activeValue: "category", ariaLabel: "มุมมองรายงาน" }));
    expect((html.match(/<a /g) ?? []).length).toBe(3);
    expect(html).toContain("h-11");
  });

  it("marks exactly the active option via aria-selected", () => {
    const html = renderToStaticMarkup(createElement(FinanceSegmentedControl, { options, activeValue: "month", ariaLabel: "มุมมองรายงาน" }));
    expect((html.match(/aria-selected="true"/g) ?? []).length).toBe(1);
    const activeAnchor = html.match(/<a[^>]*aria-selected="true"[^>]*>/)?.[0] ?? "";
    expect(activeAnchor).toContain('href="?view=month"');
  });
});
