import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Field, Input, TwoColumnFieldGrid } from "./Field";

describe("two-column form controls", () => {
  it("uses zero-minimum grid tracks and shrinkable native inputs", () => {
    const html = renderToStaticMarkup(
      <TwoColumnFieldGrid>
        <Field label="วันที่" htmlFor="date">
          <Input id="date" type="date" />
        </Field>
        <Field label="เวลา" htmlFor="time">
          <Input id="time" type="time" />
        </Field>
      </TwoColumnFieldGrid>,
    );

    expect(html).toContain("grid-cols-[minmax(0,1fr)_minmax(0,1fr)]");
    expect(html).toContain("[&amp;&gt;*]:min-w-0");
    expect(html).toContain("[min-inline-size:0]");
    expect(html).toContain("[inline-size:100%]");
  });
});
