import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FinanceOptionField } from "./FinanceOptionField";

describe("FinanceOptionField", () => {
  it("submits the selected id and exposes choices through a dialog", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceOptionField, {
        label: "Wallet",
        title: "เลือก Wallet",
        name: "walletId",
        options: [
          { id: "wallet-1", label: "Cash", description: "ส่วนตัว" },
          { id: "wallet-2", label: "House", description: "ครอบครัว" },
        ],
        value: "wallet-1",
        onChange: () => undefined,
      }),
    );

    expect(html).toContain('name="walletId" value="wallet-1"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("เลือก Wallet");
    expect(html).toContain("House");
    expect(html).not.toContain("<select");
  });

  it("renders an explicit empty choice for optional filters", () => {
    const html = renderToStaticMarkup(
      createElement(FinanceOptionField, {
        label: "หมวดหมู่",
        title: "เลือกหมวดหมู่",
        name: "categoryId",
        options: [],
        value: "",
        onChange: () => undefined,
        emptyChoice: { label: "ทั้งหมด" },
      }),
    );

    expect(html).toContain('name="categoryId" value=""');
    expect(html.match(/ทั้งหมด/g)).toHaveLength(2);
  });
});
