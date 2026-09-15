import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FinancePocketPickerSheet } from "./FinancePocketPicker";

const options = [
  {
    walletId: "wallet-a",
    walletName: "MAKE by KBank",
    pocketId: "pocket-a",
    pocketName: "Cash Box",
    currency: "THB",
    balance: "40.00",
  },
  {
    walletId: "wallet-b",
    walletName: "SCB",
    pocketId: "pocket-b",
    pocketName: "Main",
    currency: "THB",
    balance: "10.00",
  },
];

describe("FinancePocketPickerSheet", () => {
  it("uses one consistent wallet heading, Pocket metadata, balance and selected color", () => {
    const html = renderToStaticMarkup(
      createElement(FinancePocketPickerSheet, {
        open: true,
        onClose: vi.fn(),
        options,
        selectedPocketId: "pocket-a",
        onSelect: vi.fn(),
      }),
    );

    expect(html).toContain("MAKE by KBank");
    expect(html).toContain("Cash Box");
    expect(html).toContain("MAKE by KBank · THB");
    expect(html).toContain("฿40.00");
    expect(html).toContain("bg-finance-primary-soft");
  });
});
