import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }) }));

import { EditAttributedHouseholdExpenseForm } from "./EditAttributedHouseholdExpenseForm";
import type { TransactionDetail } from "../api";

function detail(overrides: Partial<TransactionDetail> = {}): TransactionDetail {
  return {
    transactionId: "t1",
    transactionType: "EXPENSE",
    title: "ค่าไฟ",
    note: null,
    occurredAt: "2026-09-10T11:40:00.000Z",
    createdAt: "2026-09-10T11:40:00.000Z",
    updatedAt: "2026-09-10T11:40:00.000Z",
    voidedAt: null,
    voidReason: null,
    voidedByName: null,
    creatorName: null,
    categoryId: null,
    categoryName: null,
    walletId: "wallet-a",
    walletName: "KBank",
    pocketId: "pocket-1",
    pocketName: "Main",
    currency: "THB",
    amount: "-400.00",
    ...overrides,
  };
}

describe("EditAttributedHouseholdExpenseForm (Phase U / 0051)", () => {
  it("renders the household explanation, prefilled household category, and no wallet or tag field", () => {
    const html = renderToStaticMarkup(
      createElement(EditAttributedHouseholdExpenseForm, {
        transaction: detail(),
        walletId: "wallet-a",
        pockets: [{ id: "pocket-1", name: "Main", sort_order: 0 } as never],
        householdCategories: [{ id: "hh-cat-1", name: "ค่าไฟ", parent_id: null, transaction_type: "EXPENSE", is_system: false, children: [] } as never],
        householdName: "บ้านสุขสันต์",
        householdCategoryId: "hh-cat-1",
        householdCategoryLabel: "ค่าไฟ",
      }),
    );
    expect(html).toContain("จ่ายจากกระเป๋าส่วนตัวแทนครอบครัว");
    expect(html).toContain("บ้านสุขสันต์");
    expect(html).toContain('type="hidden" name="householdCategoryId" value="hh-cat-1"');
    expect(html).not.toContain("กระเป๋าเงิน (Wallet)");
    expect(html).not.toContain('name="tagIds"');
    expect(html).toContain('type="hidden" name="transactionId" value="t1"');
  });
});
