import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildIncomeExpenseEntries, netWorth, walletBalance } from "@/features/transactions/domain/ledger";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/0060_credit_card_cashback.sql"), "utf8");
const form = readFileSync(resolve(process.cwd(), "src/features/credit-cards/components/CreditCardCashbackForm.tsx"), "utf8");
const cardDetail = readFileSync(resolve(process.cwd(), "src/app/(app)/finance/cards/[cardId]/page.tsx"), "utf8");

describe("credit-card cashback ledger", () => {
  it("posts one positive card adjustment and one matching negative event", () => {
    const body = migration.match(/create function public\.create_credit_card_cashback[\s\S]*?comment on function public\.create_credit_card_cashback/)?.[0] ?? "";
    expect(body).toContain("'CARD_ADJUSTMENT'");
    expect(body).toContain("values (v_transaction_id, v_card.wallet_id, v_card.system_pocket_id, p_amount)");
    expect(body).toContain("'CASHBACK', -p_amount");
    expect(body).not.toContain("create_income_expense_transaction");
  });

  it("keeps cashback out of income and expense while wallet balance changes once", () => {
    const entries = [
      ...buildIncomeExpenseEntries({ transactionType: "EXPENSE", walletId: "card", pocketId: "card-system", amount: "100.00" }),
      { walletId: "card", pocketId: "card-system", amount: "125.00" },
    ];
    expect(walletBalance(entries, "card")).toBe("25.00");
    expect(netWorth(entries)).toBe("25.00");
    expect(migration).toContain("It is not income");
  });

  it("reduces buckets in payment order and never makes principal negative", () => {
    expect(migration).toContain("b.cashback - b.late_fee");
    expect(migration).toContain("b.cashback - b.late_fee - b.fee");
    expect(migration).toContain("b.cashback - b.late_fee - b.fee - b.interest");
    expect(migration).toContain("greatest(0, b.principal");
  });

  it("derives excess cashback as unallocated credit", () => {
    expect(migration).toContain("as unallocated_credit");
    expect(migration).toContain("b.cashback - b.late_fee - b.fee - b.interest - b.principal");
    expect(cardDetail).toContain("outstanding.unallocatedCredit");
    expect(cardDetail).toContain("เครดิตส่วนเกิน");
  });

  it("validates authorization, archive state, amount and RPC grants", () => {
    expect(migration).toContain("public.is_wallet_authorized(v_card.wallet_id)");
    expect(migration).toContain("Credit card is archived");
    expect(migration).toContain("Cashback amount must be positive");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");
  });
});

describe("credit-card cashback UI", () => {
  it("explains excess credit and never calls cashback income", () => {
    expect(form).toContain("ส่วนเกินเป็นเครดิตในบัตร");
    expect(form).toContain("ไม่บันทึกเป็นรายรับ");
    expect(form).toContain("sticky bottom-3");
    expect(cardDetail).toContain("/cashback");
  });
});
