import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const quickData = read("src/features/finance/quick-add-data.ts");
const actions = read("src/features/transactions/actions.ts");
const cardApi = read("src/features/credit-cards/api.ts");
const picker = read("src/features/finance/components/FinancePocketPicker.tsx");
const page = read("src/app/(app)/wallets/[walletId]/transactions/new/page.tsx");
const cardLedger = read(
  "supabase/migrations/0056_credit_card_purchase_liability.sql",
);

describe("credit card as an expense wallet", () => {
  it("offers card pockets for expenses while keeping them out of income", () => {
    expect(quickData).toContain('transactionType === "EXPENSE"');
    expect(quickData).toContain(
      'transactionType === "EXPENSE" || pocket.pocket_type !== "CREDIT_CARD"',
    );
    expect(page).toContain(
      'transactionType === "EXPENSE" ||\n            pocket.pocket_type !== "CREDIT_CARD"',
    );
  });

  it("routes card expenses to the dedicated atomic card purchase RPC", () => {
    expect(actions).toContain("listCreditCardAccounts(supabase)");
    expect(actions).toContain("createCreditCardPurchase(supabase");
    expect(cardApi).toContain('"create_card_purchase"');
    expect(cardLedger).toContain(
      "insert into public.credit_card_liability_events",
    );
    expect(cardLedger).toContain("'PURCHASE', p_amount");
  });

  it("supports a personal card funding a household expense without double counting", () => {
    expect(actions).toContain("createAttributedCreditCardPurchase(supabase");
    expect(cardApi).toContain('"create_attributed_card_purchase"');
    expect(cardLedger).toContain(
      "Only your PERSONAL card can fund an attributed household purchase",
    );
    expect(cardLedger).toContain("public.create_attributed_household_expense(");
  });

  it("labels card debt and remaining credit instead of presenting them as cash balance", () => {
    expect(quickData).toContain("availableCredit: card.availableCredit");
    expect(quickData).toContain("liability: card.liability");
    expect(picker).toContain("วงเงินเหลือ");
    expect(picker).toContain("ค้างชำระ");
  });

  it("rejects a forged income submission targeting a card pocket", () => {
    expect(actions).toContain(
      'return { error: "บัตรเครดิตใช้บันทึกได้เฉพาะรายจ่าย" }',
    );
  });
});
