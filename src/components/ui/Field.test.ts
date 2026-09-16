import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { Field, Input, TwoColumnFieldGrid } from "./Field";

describe("two-column form controls", () => {
  it("uses zero-minimum grid tracks and shrinkable native inputs", () => {
    const dateField = Field({
      label: "วันที่",
      htmlFor: "date",
      children: createElement(Input, { id: "date", type: "date" }),
    });
    const timeField = Field({
      label: "เวลา",
      htmlFor: "time",
      children: createElement(Input, { id: "time", type: "time" }),
    });
    const html = renderToStaticMarkup(
      TwoColumnFieldGrid({ children: [dateField, timeField] }),
    );

    expect(html).toContain("grid-cols-[minmax(0,1fr)_minmax(0,1fr)]");
    expect(html).toContain("[&amp;&gt;*]:min-w-0");
    expect(html).toContain("[min-inline-size:0]");
    expect(html).toContain("[inline-size:100%]");
    expect(html).toContain("[max-inline-size:100%]");
    expect(html).toContain("box-border");
    expect(html).not.toContain("overflow-hidden");
  });

  it("stacks native date/time pairs on phone widths and restores two columns on wider screens", () => {
    for (const path of [
      "src/features/plan/components/TaskForm.tsx",
      "src/features/bills/components/BillForm.tsx",
    ]) {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");
      expect(source).toContain(
        "grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
      );
    }
  });

  it("caps native iOS date, time, datetime, and file controls at their container width", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/app/globals.css"),
      "utf8",
    );

    for (const type of [
      "date",
      "datetime-local",
      "time",
      "month",
      "week",
      "file",
    ]) {
      expect(css).toContain(`input[type="${type}"]`);
    }

    expect(css).toMatch(/form,\s*fieldset\s*\{[\s\S]*?min-inline-size:\s*0/);
    expect(css).toMatch(/input\[type="date"\][\s\S]*?inline-size:\s*100%/);
    expect(css).toMatch(/input\[type="date"\][\s\S]*?max-inline-size:\s*100%/);
    expect(css).toContain("::-webkit-date-and-time-value");
    expect(css).toContain("@supports (-webkit-touch-callout: none)");
    expect(css).toContain("-webkit-appearance: none");
  });
});
