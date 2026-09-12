import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders no back button at all — the app-level back arrow is removed (BottomNav + the browser/system back gesture cover navigation instead)", () => {
    const html = renderToStaticMarkup(createElement(PageHeader, { title: "กระเป๋าเงิน" }));
    expect(html).not.toContain('aria-label="ย้อนกลับ"');
    expect(html).not.toContain("<svg"); // no back-chevron icon rendered
    expect(html).toContain("กระเป๋าเงิน");
  });

  it("leaves no fake 44px back-button placeholder slot when there's no rightAction either", () => {
    const html = renderToStaticMarkup(createElement(PageHeader, { title: "หน้า" }));
    // Only the header + the title <h1> should exist — no leftover empty
    // size-11 slot standing in for the removed back button.
    expect((html.match(/<div/g) ?? []).length).toBe(0);
    expect(html).not.toContain("size-11");
  });

  it("supports a right-side action, positioned absolute so it never claims flow space", () => {
    const html = renderToStaticMarkup(
      createElement(PageHeader, { title: "หน้า", rightAction: createElement("a", { href: "/new" }, "+") }),
    );
    expect(html).toContain('href="/new"');
    expect(html).toContain("absolute right-0");
  });

  it("keeps the title centered against the full header width regardless of rightAction — never re-centered relative to a narrower remaining strip", () => {
    const withoutAction = renderToStaticMarkup(createElement(PageHeader, { title: "หน้า" }));
    const withAction = renderToStaticMarkup(
      createElement(PageHeader, { title: "หน้า", rightAction: createElement("a", { href: "/new" }, "+") }),
    );
    // Centering comes from `justify-center` on the header + the title
    // having no sibling that claims flow space (rightAction is
    // `absolute`) — so the <h1>'s own classes are identical either way.
    const titleClass = (html: string) => html.match(/<h1 class="([^"]*)"/)?.[1];
    expect(titleClass(withoutAction)).toBe(titleClass(withAction));
    expect(withAction).toContain("relative flex h-14 items-center justify-center");
  });

  it("keeps the ~56px header height", () => {
    const html = renderToStaticMarkup(createElement(PageHeader, { title: "หน้า" }));
    expect(html).toContain("h-14"); // 3.5rem = 56px
  });
});
