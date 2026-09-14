import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Pocket } from "@/features/pockets/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { getPocketTransferDefaults, PocketTransferForm } from "./PocketTransferForm";

function pocket(id: string, name: string): Pocket {
  return {
    id,
    wallet_id: "11111111-1111-4111-8111-111111111111",
    name,
    icon: null,
    sort_order: 0,
    is_archived: false,
    created_at: "2026-09-08T00:00:00Z",
    updated_at: "2026-09-08T00:00:00Z",
  };
}

describe("PocketTransferForm endpoint defaults (UI convenience only, no domain default pocket)", () => {
  it("returns no usable endpoints with fewer than two pockets", () => {
    expect(getPocketTransferDefaults([pocket("only", "Everyday")])).toBeNull();
  });

  it("pre-selects the first two pockets in list order — order is not a persisted default", () => {
    expect(getPocketTransferDefaults([pocket("food", "Food"), pocket("travel", "Travel")])).toEqual({
      fromPocketId: "food",
      toPocketId: "travel",
    });
  });

  it("works identically regardless of pocket naming — no pocket is treated as special", () => {
    expect(getPocketTransferDefaults([pocket("a", "Anything"), pocket("b", "Something Else"), pocket("c", "A Third One")])).toEqual({
      fromPocketId: "a",
      toPocketId: "b",
    });
  });
});

describe("PocketTransferForm — Phase V (0052) fee/interest sections", () => {
  it("renders both optional charge sections, the currency in the amount label, and the pre-save summary", () => {
    const html = renderToStaticMarkup(
      createElement(PocketTransferForm, {
        walletId: "wallet-a",
        pockets: [pocket("food", "Food"), pocket("travel", "Travel")],
        tags: [],
        currency: "THB",
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
