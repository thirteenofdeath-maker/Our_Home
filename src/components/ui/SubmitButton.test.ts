import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const status = vi.hoisted(() => ({ pending: false }));
vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormStatus: () => status,
}));
import { SubmitButton } from "./SubmitButton";

describe("SubmitButton submission feedback", () => {
  it("keeps the label and its width while loading, and cannot be re-enabled by disabled=false", () => {
    status.pending = true;
    const html = renderToStaticMarkup(
      createElement(SubmitButton, { disabled: false }, "ทำเสร็จแล้ว"),
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("opacity-0");
    expect(html).toContain("ทำเสร็จแล้ว");
  });

  it("preserves caller validation locks outside submission and restores normal enabled state", () => {
    status.pending = false;
    expect(
      renderToStaticMarkup(
        createElement(SubmitButton, { disabled: true }, "บันทึก"),
      ),
    ).toContain('disabled=""');
    const html = renderToStaticMarkup(
      createElement(SubmitButton, { disabled: false }, "บันทึก"),
    );
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('aria-busy="true"');
    expect(html).toContain("บันทึก");
  });
});
