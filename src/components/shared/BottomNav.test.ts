import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

let mockPathname = "/finance";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { BottomNav, NAV_ITEMS } from "./BottomNav";

describe("Bottom navigation — pure navigation, exactly five destinations", () => {
  it("points the finance destination at /finance", () => {
    const finance = NAV_ITEMS.find((item) => item.label === "การเงิน");
    expect(finance?.href).toBe("/finance");
  });

  it("has the five locked destinations, and never Wallet/Category/Tasks/Shopping as competing destinations", () => {
    expect(NAV_ITEMS).toHaveLength(5);
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(hrefs).toEqual([
      "/",
      "/finance",
      "/calendar",
      "/pets",
      "/household",
    ]);
    expect(hrefs).not.toContain("/wallets");
    expect(hrefs).not.toContain("/categories");
    expect(hrefs).not.toContain("/tasks");
    expect(hrefs).not.toContain("/shopping");
  });

  it("takes no centerAction/quick-add prop at all — it is pure navigation", () => {
    expect(BottomNav.length).toBe(0);
  });

  it("always renders exactly five real <a> destinations, on every module alike", () => {
    for (const pathname of [
      "/",
      "/finance",
      "/pets",
      "/calendar",
      "/household",
    ]) {
      mockPathname = pathname;
      const html = renderToStaticMarkup(createElement(BottomNav));
      expect((html.match(/<a /g) ?? []).length).toBe(5);
    }
  });

  it("uses five equal navigation columns — no raised center-action cell", () => {
    mockPathname = "/finance";
    const html = renderToStaticMarkup(createElement(BottomNav));
    expect(html).toContain("grid-cols-5");
    expect(html).not.toContain("grid-cols-[1fr_1fr_4rem_1fr_1fr]");
    expect(html).not.toContain("4rem_1fr_1fr");
  });

  it("keeps the safe-area bottom padding/offset on the nav bar itself", () => {
    mockPathname = "/finance";
    const html = renderToStaticMarkup(createElement(BottomNav));
    expect(html).toContain("safe-area-inset-bottom");
  });

  it("keeps a nested route's parent destination active (startsWith, not just exact match)", () => {
    const cases: Array<[string, string]> = [
      ["/", "/"],
      ["/finance/reports", "/finance"],
      ["/pets/new", "/pets"],
      ["/calendar/2026-01-01", "/calendar"],
      ["/household/members", "/household"],
    ];
    for (const [pathname, activeHref] of cases) {
      mockPathname = pathname;
      const html = renderToStaticMarkup(createElement(BottomNav));
      // The active <a> for this destination carries aria-current="page".
      const activeAnchor =
        html.match(
          new RegExp(`<a[^>]*href="${activeHref.replace("/", "\\/")}"[^>]*>`),
        )?.[0] ?? "";
      expect(
        activeAnchor,
        `${pathname} should keep ${activeHref} active`,
      ).toContain('aria-current="page"');
    }
  });

  it("keeps การเงิน active on Finance-owned secondary route families, not just /finance itself", () => {
    for (const pathname of [
      "/wallets",
      "/wallets/abc/manage",
      "/categories",
      "/categories/xyz",
    ]) {
      mockPathname = pathname;
      const html = renderToStaticMarkup(createElement(BottomNav));
      const activeAnchor =
        html.match(/<a[^>]*href="\/finance"[^>]*>/)?.[0] ?? "";
      expect(activeAnchor, `${pathname} should keep /finance active`).toContain(
        'aria-current="page"',
      );
      expect(html, `${pathname} should render in Finance V2 tone`).toContain(
        "finance-scope",
      );
    }
  });

  it("activates no tab at all on a neutral route", () => {
    mockPathname = "/profile/edit";
    const html = renderToStaticMarkup(createElement(BottomNav));
    expect(html).not.toContain('aria-current="page"');
  });

  it("uses the SAME floating-capsule architecture on every module — only the color tokens differ", () => {
    mockPathname = "/finance";
    const finance = renderToStaticMarkup(createElement(BottomNav));
    expect(finance).toContain("finance-scope");
    expect(finance).toContain("inset-x-3");
    expect(finance).toContain("rounded-[1.75rem]");
    expect(finance).toContain("bg-finance-surface-strong");

    for (const pathname of ["/pets", "/calendar", "/household"]) {
      mockPathname = pathname;
      const html = renderToStaticMarkup(createElement(BottomNav));
      expect(html, `${pathname} should not carry finance-scope`).not.toContain(
        "finance-scope",
      );
      // Same structural shell as Finance: fixed, inset-x-3, rounded-[1.75rem].
      expect(html).toContain("inset-x-3");
      expect(html).toContain("rounded-[1.75rem]");
      expect(html).toContain("bg-surface");
    }
  });

  it("keeps the active icon treatment inside the clipped nav surface", () => {
    mockPathname = "/pets";
    const html = renderToStaticMarkup(createElement(BottomNav));
    expect(html).toContain("overflow-hidden");
    expect(html).toContain("bg-primary-soft");
    expect(html).not.toContain("-translate-y");
  });
});
