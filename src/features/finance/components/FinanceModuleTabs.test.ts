import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

let mockPathname = "/finance";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { FINANCE_MODULES, FinanceModuleTabs } from "./FinanceModuleTabs";

describe("FinanceModuleTabs", () => {
  it("keeps overview, transactions and wallets first and exposes every finance module", () => {
    expect(FINANCE_MODULES.slice(0, 3).map((m) => m.href)).toEqual([
      "/finance",
      "/finance/transactions",
      "/wallets",
    ]);
    for (const route of [
      "budgets",
      "goals",
      "bills",
      "debts",
      "installments",
      "recurring",
      "templates",
      "reports",
      "insights",
      "net-worth",
      "tags",
      "import",
      "export",
    ]) {
      expect(FINANCE_MODULES.some((m) => m.href === `/finance/${route}`)).toBe(
        true,
      );
    }
    expect(FINANCE_MODULES.some((m) => m.href === "/categories")).toBe(true);
  });

  it("renders every module as a real, accessible link with a 44px touch target", () => {
    mockPathname = "/finance";
    const html = renderToStaticMarkup(createElement(FinanceModuleTabs));
    for (const financeModule of FINANCE_MODULES) {
      expect(html).toContain(`href="${financeModule.href}"`);
    }
    expect((html.match(/<a /g) ?? []).length).toBe(FINANCE_MODULES.length);
    expect(html).toContain("h-11");
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

  it("contains overflow in a scrollable module row", () => {
    const html = renderToStaticMarkup(createElement(FinanceModuleTabs));
    expect(html).toContain("overflow-x-auto");
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

it.each([
  "/wallets/abc/manage",
  "/finance/budgets/abc/edit",
  "/finance/bills/occurrences/abc",
  "/categories",
])("selects only the owning module at %s", (path) => {
  mockPathname = path;
  const html = renderToStaticMarkup(createElement(FinanceModuleTabs));
  const links = html.match(/<a[^>]*aria-current="page"[^>]*>/g) ?? [];
  expect(links).toHaveLength(1);
  const expected = path.startsWith("/wallets")
    ? "/wallets"
    : path.startsWith("/categories")
      ? "/categories"
      : path.split("/").slice(0, 3).join("/");
  expect(links[0]).toContain(`href="${expected}"`);
});
