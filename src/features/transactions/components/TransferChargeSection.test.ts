import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { TransferChargeSection } from "./TransferChargeSection";

const categories = [{ id: "cat-1", name: "ค่าธรรมเนียมธนาคาร", parent_id: null, transaction_type: "EXPENSE", is_system: false, children: [] } as never];

describe("TransferChargeSection (Phase V / 0052)", () => {
  it("is collapsed by default (a native <details> with no `open` attribute)", () => {
    const html = renderToStaticMarkup(
      createElement(TransferChargeSection, {
        title: "ค่าธรรมเนียม",
        amountFieldName: "feeAmount",
        categoryFieldName: "feeCategoryId",
        categories,
        walletId: "wallet-a",
        amount: "",
        onAmountChange: vi.fn(),
      }),
    );
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    expect(html).toContain("ค่าธรรมเนียม (ถ้ามี)");
  });

  it("names the amount and category fields exactly as given, for both fee and interest", () => {
    const html = renderToStaticMarkup(
      createElement(TransferChargeSection, {
        title: "ดอกเบี้ย",
        amountFieldName: "interestAmount",
        categoryFieldName: "interestCategoryId",
        categories,
        walletId: "wallet-a",
        amount: "10.00",
        onAmountChange: vi.fn(),
      }),
    );
    expect(html).toContain('name="interestAmount"');
    expect(html).toContain('type="hidden" name="interestCategoryId"');
  });

  it("shows the expense-not-principal reminder once a positive amount is entered", () => {
    const html = renderToStaticMarkup(
      createElement(TransferChargeSection, {
        title: "ค่าธรรมเนียม",
        amountFieldName: "feeAmount",
        categoryFieldName: "feeCategoryId",
        categories,
        walletId: "wallet-a",
        amount: "5.00",
        onAmountChange: vi.fn(),
      }),
    );
    expect(html).toContain("เป็นรายจ่าย ไม่ใช่ส่วนหนึ่งของเงินต้นที่โอน");
  });
});
