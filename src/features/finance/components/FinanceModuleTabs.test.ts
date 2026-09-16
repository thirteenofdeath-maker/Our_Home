import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

let mockPathname = "/finance";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { FINANCE_MODULES, FinanceModuleTabs } from "./FinanceModuleTabs";

describe("FinanceModuleTabs", () => {
  it("has exactly the three primary modules, each pointing at its existing route", () => {
    expect(FINANCE_MODULES).toHaveLength(3);
    expect(FINANCE_MODULES.map((m) => m.label)).toEqual([
      "ภาพรวม",
      "ธุรกรรม",
      "กระเป๋า",
    ]);
    expect(FINANCE_MODULES.map((m) => m.href)).toEqual([
      "/finance",
      "/finance/transactions",
      "/wallets",
    ]);
  });

  it("renders every module as a real, accessible link with a 44px touch target", () => {
    mockPathname = "/finance";
    const html = renderToStaticMarkup(createElement(FinanceModuleTabs));
    for (const financeModule of FINANCE_MODULES) {
      expect(html).toContain(`href="${financeModule.href}"`);
    }
    expect((html.match(/<a /g) ?? []).length).toBe(3);
    expect(html).toContain("h-10");
  });

  it("marks exactly the current module as active via aria-current", () => {
    mockPathname = "/finance/transactions";
    const html = renderToStaticMarkup(createElement(FinanceModuleTabs));
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('href="/finance/transactions"');
    // The active pill is the one carrying both attributes on the same <a>.
    const activeAnchor =
      html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0] ?? "";
    expect(activeAnchor).toContain('href="/finance/transactions"');
  });

  it("renders as one non-scrolling three-column row", () => {
    const html = renderToStaticMarkup(createElement(FinanceModuleTabs));
    expect(html).toContain("grid-cols-3");
    expect(html).not.toContain("overflow-x-auto");
  });

  it("uses a shared rounded surface with a soft active segment", () => {
    mockPathname = "/wallets";
    const html = renderToStaticMarkup(createElement(FinanceModuleTabs));
    expect(html).toContain("bg-finance-surface-strong");
    expect(html).toContain("rounded-[1.15rem]");
    const activeAnchor =
      html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0] ?? "";
    expect(activeAnchor).toContain("bg-finance-primary-soft");
  });
});
