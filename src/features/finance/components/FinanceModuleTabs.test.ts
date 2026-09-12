import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

let mockPathname = "/finance";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { FINANCE_MODULES, FinanceModuleTabs } from "./FinanceModuleTabs";

describe("FinanceModuleTabs", () => {
  it("has exactly the seven expected modules, each pointing at its existing route", () => {
    expect(FINANCE_MODULES).toHaveLength(7);
    expect(FINANCE_MODULES.map((m) => m.label)).toEqual(["ภาพรวม", "รายงาน", "งบประมาณ", "ผ่อนชำระ", "ยืม-ให้ยืม", "ออมเงิน", "มูลค่าสุทธิ"]);
    expect(FINANCE_MODULES.map((m) => m.href)).toEqual([
      "/finance",
      "/finance/reports",
      "/finance/budgets",
      "/finance/installments",
      "/finance/debts",
      "/finance/goals",
      "/finance/net-worth",
    ]);
  });

  it("renders every module as a real, accessible link with a 44px touch target", () => {
    mockPathname = "/finance";
    const html = renderToStaticMarkup(createElement(FinanceModuleTabs));
    for (const financeModule of FINANCE_MODULES) {
      expect(html).toContain(`href="${financeModule.href}"`);
    }
    expect((html.match(/<a /g) ?? []).length).toBe(7);
    expect(html).toContain("h-11"); // 44px
  });

  it("marks exactly the current module as active via aria-current", () => {
    mockPathname = "/finance/budgets";
    const html = renderToStaticMarkup(createElement(FinanceModuleTabs));
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('href="/finance/budgets"');
    // The active pill is the one carrying both attributes on the same <a>.
    const activeAnchor = html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0] ?? "";
    expect(activeAnchor).toContain('href="/finance/budgets"');
  });

  it("scrolls horizontally instead of wrapping", () => {
    const html = renderToStaticMarkup(createElement(FinanceModuleTabs));
    expect(html).toContain("overflow-x-auto");
    expect(html).not.toMatch(/flex-wrap/);
  });

  it("reads as compact HEADER nav — no detached card chrome (no surface background/shadow/large radius on the <nav> itself)", () => {
    mockPathname = "/finance/budgets";
    const html = renderToStaticMarkup(createElement(FinanceModuleTabs));
    const navOpenTag = html.match(/<nav[^>]*>/)?.[0] ?? "";
    expect(navOpenTag).not.toContain("bg-finance-surface-strong");
    expect(navOpenTag).not.toContain("rounded-[1.75rem]");
    expect(navOpenTag).not.toMatch(/shadow-/);

    // Only the active tab gets its own pill background; every inactive
    // tab sits fully transparent (no per-tab "card" look, no rail either).
    const inactiveAnchor = html.match(/<a(?:(?!aria-current)[^>])*href="\/finance"[^>]*>/)?.[0] ?? "";
    expect(inactiveAnchor).toContain("bg-transparent");
    expect(inactiveAnchor).not.toContain("bg-finance-primary-soft");
    const activeAnchor = html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0] ?? "";
    expect(activeAnchor).toContain("bg-finance-primary-soft");
  });
});
