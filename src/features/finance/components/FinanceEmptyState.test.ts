import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FinanceEmptyState } from "./FinanceEmptyState";

describe("FinanceEmptyState", () => {
  it("renders icon, title, description, and an optional action — never a bare floating CTA", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceEmptyState, {
        icon: "finance",
        title: "ยังไม่มีงบประมาณ",
        description: "เริ่มวางแผนการเงินของคุณ",
        action: createElement("a", { href: "/finance/budgets/new" }, "+ สร้างงบประมาณ"),
      }),
    );
    expect(html).toContain("ยังไม่มีงบประมาณ");
    expect(html).toContain("เริ่มวางแผนการเงินของคุณ");
    expect(html).toContain("สร้างงบประมาณ");
  });

  it("stays compact — no full-viewport centering utility classes", () => {
    const html = renderToStaticMarkup(createElement(FinanceEmptyState, { icon: "finance", title: "x" }));
    expect(html).not.toMatch(/min-h-screen|h-screen/);
  });
});
