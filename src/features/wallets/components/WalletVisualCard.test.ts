import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WalletVisualCard } from "./WalletVisualCard";

const base = { id: "w1", name: "MAKE by KBank", currency: "THB", scopeLabel: "ส่วนตัว", balance: "12450.00" };

describe("WalletVisualCard", () => {
  it("links to the wallet, shows name/currency/scope, and never combines currencies", () => {
    const html = renderToStaticMarkup(createElement(WalletVisualCard, { ...base, index: 0 }));
    expect(html).toContain('href="/wallets/w1"');
    expect(html).toContain("MAKE by KBank");
    expect(html).toContain("THB");
    expect(html).toContain("ส่วนตัว");
    expect(html).toContain("฿12,450.00");
  });

  it("picks a deterministic accent from the wallet's own stable index, not randomly per render", () => {
    const first = renderToStaticMarkup(createElement(WalletVisualCard, { ...base, index: 2 }));
    const second = renderToStaticMarkup(createElement(WalletVisualCard, { ...base, index: 2 }));
    expect(first).toBe(second);
  });

  it("cycles accents across different indices without a stored style field", () => {
    const a = renderToStaticMarkup(createElement(WalletVisualCard, { ...base, index: 0 }));
    const b = renderToStaticMarkup(createElement(WalletVisualCard, { ...base, index: 1 }));
    expect(a).not.toBe(b);
  });

  it("defaults to the gallery variant (used by /wallets' two-column grid)", () => {
    const html = renderToStaticMarkup(createElement(WalletVisualCard, { ...base, index: 0 }));
    expect(html).toContain("h-[165px]");
    expect(html).not.toContain("w-[160px]");
  });

  it("sizes the compact variant (used by /finance's horizontal snapshot) within the requested small footprint", () => {
    const html = renderToStaticMarkup(createElement(WalletVisualCard, { ...base, index: 0, variant: "compact" }));
    expect(html).toContain("h-[155px]");
    expect(html).toContain("w-[160px]");
    // Still shows every required fact, just more tightly.
    expect(html).toContain("MAKE by KBank");
    expect(html).toContain("฿12,450.00");
  });
});
