import { describe, expect, it } from "vitest";

import { NAV_ITEMS } from "./BottomNav";

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
});
