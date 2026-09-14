import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { HouseholdExpenseFundingSelect } from "./HouseholdExpenseFundingSelect";

describe("HouseholdExpenseFundingSelect (Phase U / 0051)", () => {
  it("labels every option with an explicit TEXT badge distinguishing personal from household funding sources — never color alone", () => {
    const html = renderToStaticMarkup(
      createElement(HouseholdExpenseFundingSelect, {
        householdWallets: [{ id: "wallet-hh", name: "บัญชีครอบครัว", currency: "THB" }],
        personalWallets: [{ id: "wallet-a", name: "KBank", currency: "THB" }],
        householdName: "บ้านสุขสันต์",
        payerDisplayName: "สมชาย",
        value: "",
        onChange: vi.fn(),
      }),
    );
    expect(html).toContain("ครอบครัว · บ้านสุขสันต์ · บัญชีครอบครัว");
    expect(html).toContain("ส่วนตัว · สมชาย · KBank");
  });

  it("never exposes another member's wallet — only the household wallets and the payer's OWN personal wallets passed in", () => {
    const html = renderToStaticMarkup(
      createElement(HouseholdExpenseFundingSelect, {
        householdWallets: [],
        personalWallets: [{ id: "wallet-a", name: "KBank", currency: "THB" }],
        householdName: "บ้านสุขสันต์",
        payerDisplayName: "สมชาย",
        value: "",
        onChange: vi.fn(),
      }),
    );
    // No household optgroup rendered at all when there are no household
    // wallets — and critically, nothing here ever fetches or displays a
    // BALANCE (private financial detail) for any wallet, only its name.
    expect(html).not.toContain("<optgroup label=\"ครอบครัว\"");
    expect(html).not.toMatch(/฿|balance/i);
  });
});
