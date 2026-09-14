import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { WalletTransferForm } from "./WalletTransferForm";

function wallet(overrides: { id: string; name: string }) {
  return {
    scope: "PERSONAL",
    owner_user_id: "user-a",
    household_id: null,
    wallet_type: "BANK",
    currency: "THB",
    icon: null,
    is_archived: false,
    created_by: "user-a",
    created_at: "2026-09-08T00:00:00Z",
    updated_at: "2026-09-08T00:00:00Z",
    ...overrides,
  };
}

const fromWallet = wallet({ id: "wallet-a", name: "KBank" });
const otherWallet = wallet({ id: "wallet-b", name: "SCB" });

describe("WalletTransferForm — Phase V (0052) fee/interest sections", () => {
  it("renders both optional charge sections, the currency in the amount label, and the pre-save summary", () => {
    const html = renderToStaticMarkup(
      createElement(WalletTransferForm, {
        fromWallet: fromWallet as never,
        fromPockets: [],
        otherWallets: [otherWallet as never],
        pocketsByWallet: {},
        tags: [],
        expenseCategories: [],
      }),
    );
    expect(html).toContain("จำนวนเงิน (THB)");
    expect(html).toContain("ค่าธรรมเนียม (ถ้ามี)");
    expect(html).toContain("ดอกเบี้ย (ถ้ามี)");
    expect(html).toContain("name=\"feeAmount\"");
    expect(html).toContain("name=\"interestAmount\"");
    expect(html).toContain("เงินต้นไม่ใช่รายรับหรือรายจ่าย");
  });
});
