import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders no back button when backHref is omitted — Back is an explicit per-page opt-in, never a default", () => {
    const html = renderToStaticMarkup(createElement(PageHeader, { title: "กระเป๋าเงิน" }));
    expect(html).not.toContain('aria-label="ย้อนกลับ"');
    expect(html).toContain("กระเป๋าเงิน");
  });

  it("leaves no fake 44px back-button placeholder slot when neither backHref nor rightAction is supplied", () => {
    const html = renderToStaticMarkup(createElement(PageHeader, { title: "หน้า" }));
    expect((html.match(/<div/g) ?? []).length).toBe(0);
    expect(html).not.toContain("size-11");
  });

  it("renders a Back link to the exact supplied semantic href, absolutely positioned on the left, when backHref is supplied", () => {
    const html = renderToStaticMarkup(createElement(PageHeader, { title: "หน้า", backHref: "/wallets/abc" }));
    expect(html).toContain('aria-label="ย้อนกลับ"');
    expect(html).toContain('href="/wallets/abc"');
    expect(html).toContain("absolute left-0");
  });

  it("supports Back and rightAction together without either disturbing the other", () => {
    const html = renderToStaticMarkup(
      createElement(PageHeader, { title: "หน้า", backHref: "/wallets/abc", rightAction: createElement("a", { href: "/new" }, "+") }),
    );
    expect(html).toContain("absolute left-0");
    expect(html).toContain("absolute right-0");
    expect(html).toContain('href="/new"');
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
