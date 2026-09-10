import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));

import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders an accessible 44px back control and title", () => {
    const html = renderToStaticMarkup(createElement(PageHeader, { title: "กระเป๋าเงิน", fallbackHref: "/finance" }));
    expect(html).toContain('aria-label="ย้อนกลับ"');
    expect(html).toContain("size-11");
    expect(html).toContain("กระเป๋าเงิน");
    expect(html).toContain("‹");
  });

  it("supports a right-side action", () => {
    const html = renderToStaticMarkup(createElement(PageHeader, {
      title: "หน้า", fallbackHref: "/finance", rightAction: createElement("a", { href: "/new" }, "+"),
    }));
    expect(html).toContain('href="/new"');
  });
});
