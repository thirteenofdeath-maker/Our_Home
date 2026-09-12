import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FinanceDonutChart } from "./FinanceDonutChart";

describe("FinanceDonutChart", () => {
  it("draws one arc per segment, purely from caller-supplied ratios", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceDonutChart, {
        segments: [
          { id: "food", ratio: 0.6, colorClassName: "stroke-finance-expense" },
          { id: "transport", ratio: 0.4, colorClassName: "stroke-finance-primary" },
        ],
      }),
    );
    expect((html.match(/<circle/g) ?? []).length).toBe(3); // background track + 2 segments
    expect(html).toContain("stroke-finance-expense");
    expect(html).toContain("stroke-finance-primary");
  });

  it("renders a single full ring when there is only one category (a legitimate case, not a bug)", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceDonutChart, { segments: [{ id: "only", ratio: 1, colorClassName: "stroke-finance-income" }] }),
    );
    expect((html.match(/<circle/g) ?? []).length).toBe(2); // background track + 1 full segment
  });

  it("is presentation-only — no text/number content of its own", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceDonutChart, { segments: [{ id: "a", ratio: 1, colorClassName: "stroke-finance-income" }] }),
    );
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/[0-9]%|฿/);
  });

  it("rotates via the SVG-native transform attribute, never a CSS class, so the center is unambiguous across browsers", () => {
    // A CSS `-rotate-90` class resolves `transform-origin` against a
    // reference box that has historically differed between engines for
    // SVG elements (some resolve it against the SVG viewport's own
    // corner instead of the element's center), which can rotate the
    // ring off-canvas. The SVG `transform` attribute's rotation center
    // is explicit user-space coordinates — no such ambiguity.
    const html = renderToStaticMarkup(
      createElement(FinanceDonutChart, { segments: [{ id: "a", ratio: 1, colorClassName: "stroke-finance-income" }], size: 140 }),
    );
    expect(html).toContain('transform="rotate(-90 70 70)"');
    expect(html).not.toMatch(/class="[^"]*-rotate-90/);
  });
});
