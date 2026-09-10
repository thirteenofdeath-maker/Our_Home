import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

let mockPathname = "/finance";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { BottomNav, NAV_ITEMS } from "./BottomNav";
import { GlobalQuickAdd } from "./GlobalQuickAdd";

describe("Bottom navigation (Finance Hub information architecture)", () => {
  it("points the finance destination at /finance", () => {
    const finance = NAV_ITEMS.find((item) => item.label === "การเงิน");
    expect(finance?.href).toBe("/finance");
  });

  it("does not expose Wallet or Category as competing top-level destinations", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(hrefs).not.toContain("/wallets");
    expect(hrefs).not.toContain("/categories");
  });

  it("preserves Household, Pets, and Calendar, and does not start Tasks or Shopping", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(hrefs).toEqual(expect.arrayContaining(["/household", "/pets", "/calendar"]));
    expect(hrefs).not.toContain("/tasks");
    expect(hrefs).not.toContain("/shopping");
  });

  it("always renders exactly four real <a> destinations, on /finance and elsewhere alike", () => {
    mockPathname = "/finance";
    const onFinance = renderToStaticMarkup(createElement(BottomNav, { centerAction: createElement("span", null, "add") }));
    expect((onFinance.match(/<a /g) ?? []).length).toBe(4);

    mockPathname = "/pets";
    const onPets = renderToStaticMarkup(createElement(BottomNav, { centerAction: createElement("span", null, "add") }));
    expect((onPets.match(/<a /g) ?? []).length).toBe(4);
  });

  it("gives /finance a real center grid cell for the quick-add action, in between the four links (not a 5th destination)", () => {
    mockPathname = "/finance";
    const html = renderToStaticMarkup(createElement(BottomNav, { centerAction: createElement("span", { "data-testid": "quick-add" }, "add") }));
    expect(html).toContain("grid-cols-[1fr_1fr_4rem_1fr_1fr]");
    expect(html).toContain('data-testid="quick-add"');
    // The center action sits between "การเงิน"+"สัตว์เลี้ยง" and "ปฏิทิน"+"ครอบครัว".
    const financeIdx = html.indexOf("การเงิน");
    const petsIdx = html.indexOf("สัตว์เลี้ยง");
    const centerIdx = html.indexOf('data-testid="quick-add"');
    const calendarIdx = html.indexOf("ปฏิทิน");
    const householdIdx = html.indexOf("ครอบครัว");
    expect(financeIdx).toBeLessThan(petsIdx);
    expect(petsIdx).toBeLessThan(centerIdx);
    expect(centerIdx).toBeLessThan(calendarIdx);
    expect(calendarIdx).toBeLessThan(householdIdx);
  });

  it("never shows the center action on other top-level pages, and falls back to the plain four-column layout", () => {
    mockPathname = "/pets";
    const html = renderToStaticMarkup(createElement(BottomNav, { centerAction: createElement("span", { "data-testid": "quick-add" }, "add") }));
    expect(html).not.toContain("grid-cols-[1fr_1fr_4rem_1fr_1fr]");
    expect(html).not.toContain('data-testid="quick-add"');
  });

  it("keeps the safe-area bottom padding on the nav bar itself", () => {
    mockPathname = "/finance";
    const html = renderToStaticMarkup(createElement(BottomNav, {}));
    expect(html).toContain("safe-area-inset-bottom");
  });

  it("renders the real GlobalQuickAdd as a fifth CELL, not a fifth destination link with nav semantics", () => {
    mockPathname = "/finance";
    const html = renderToStaticMarkup(createElement(BottomNav, { centerAction: createElement(GlobalQuickAdd, { walletId: "w1" }) }));
    // 4 nav <a> + 1 quick-add <a> = 5 anchors total, but only 4 of them
    // carry an href matching a real NAV_ITEMS destination.
    expect((html.match(/<a /g) ?? []).length).toBe(5);
    for (const item of NAV_ITEMS) expect(html).toContain(`href="${item.href}"`);
    expect(html).toContain('aria-label="เพิ่มรายการการเงิน"');
    // The quick-add action never participates in "current page" nav
    // semantics — it has no active/inactive state of its own.
    expect(html).not.toContain("aria-current");
  });

  it("uses the Finance V2 blue-gray palette for the quick-add action, not the older sage-green primary", () => {
    const html = renderToStaticMarkup(createElement(GlobalQuickAdd, { walletId: "w1" }));
    expect(html).toContain("bg-finance-primary");
    expect(html).not.toMatch(/\bbg-primary\b/);
  });

  it("floats as a rounded capsule on /finance, inset from the screen edges, while staying an edge-to-edge bar elsewhere", () => {
    mockPathname = "/finance";
    const finance = renderToStaticMarkup(createElement(BottomNav, {}));
    expect(finance).toContain("finance-scope");
    expect(finance).toContain("inset-x-4");
    expect(finance).toContain("rounded-[2rem]");
    expect(finance).toContain("bg-finance-surface-strong");

    mockPathname = "/pets";
    const pets = renderToStaticMarkup(createElement(BottomNav, {}));
    expect(pets).not.toContain("finance-scope");
    expect(pets).not.toContain("rounded-[2rem]");
    expect(pets).toContain("inset-x-0");
  });
});
