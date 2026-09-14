import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildIncomeExpenseEntries, buildWalletTransferEntries, netWorth, sumAmounts, walletBalance } from "@/features/transactions/domain/ledger";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/0058_credit_card_charges_and_allocations.sql"), "utf8");
const chargeForm = readFileSync(resolve(process.cwd(), "src/features/credit-cards/components/CreditCardIssuerChargeForm.tsx"), "utf8");
const paymentForm = readFileSync(resolve(process.cwd(), "src/features/credit-cards/components/CreditCardPaymentForm.tsx"), "utf8");
const detail = readFileSync(resolve(process.cwd(), "src/app/(app)/finance/cards/[cardId]/page.tsx"), "utf8");
const exportRoute = readFileSync(resolve(process.cwd(), "src/app/(app)/finance/export/download/route.ts"), "utf8");

describe("credit-card issuer charges and payment allocation", () => {
  it("records actual issuer charges once as expenses and never reads APR", () => {
    const chargeBody = migration.match(/create function public\.create_credit_card_issuer_charge[\s\S]*?comment on function public\.create_credit_card_issuer_charge/)?.[0] ?? "";
    expect(chargeBody).toContain("public.create_income_expense_transaction(");
    expect(chargeBody).toContain("'EXPENSE'");
    expect(chargeBody).toContain("expense.finance_fees.card_interest");
    expect(chargeBody).toContain("expense.finance_fees.card");
    expect(chargeBody).toContain("expense.finance_fees.penalties");
    expect(chargeBody).not.toMatch(/\bapr\b/i);
  });

  it("allocates one payment deterministically without creating another expense", () => {
    const paymentBody = migration.match(/create or replace function public\.create_credit_card_payment[\s\S]*?comment on function public\.create_credit_card_payment/)?.[0] ?? "";
    expect(paymentBody).toContain("late fee -> fee -> interest -> principal");
    expect(paymentBody).toContain("'PAYMENT_LATE_FEE'");
    expect(paymentBody).toContain("'PAYMENT_FEE'");
    expect(paymentBody).toContain("'PAYMENT_INTEREST'");
    expect(paymentBody).toContain("'PAYMENT_PRINCIPAL'");
    expect(paymentBody).toContain("public.create_wallet_transfer(");
    expect(paymentBody).not.toContain("public.create_income_expense_transaction(");
  });

  it("numerically keeps payment net-worth-neutral while charges count once", () => {
    const entries = [
      { walletId: "cash", pocketId: "cash-main", amount: "10000.00" },
      ...buildIncomeExpenseEntries({ transactionType: "EXPENSE", walletId: "card", pocketId: "card-system", amount: "2000.00" }),
      ...buildIncomeExpenseEntries({ transactionType: "EXPENSE", walletId: "card", pocketId: "card-system", amount: "25.00" }),
      ...buildIncomeExpenseEntries({ transactionType: "EXPENSE", walletId: "card", pocketId: "card-system", amount: "10.00" }),
      ...buildIncomeExpenseEntries({ transactionType: "EXPENSE", walletId: "card", pocketId: "card-system", amount: "5.00" }),
      ...buildWalletTransferEntries({ fromWalletId: "cash", fromPocketId: "cash-main", toWalletId: "card", toPocketId: "card-system", amount: "100.00" }),
    ];
    expect(walletBalance(entries, "cash")).toBe("9900.00");
    expect(walletBalance(entries, "card")).toBe("-1940.00");
    expect(netWorth(entries)).toBe("7960.00");
    expect(sumAmounts(["2000.00", "25.00", "10.00", "5.00"])).toBe("2040.00");
  });

  it("protects every bucket during void and restore", () => {
    expect(migration).toContain("transactions_prevent_negative_card_components");
    expect(migration).toContain("v_principal < 0 or v_interest < 0 or v_fee < 0 or v_late_fee < 0");
    expect(migration).toContain("A card liability component cannot become negative");
  });

  it("blocks generic refunds from drifting issuer charges", () => {
    expect(migration).toContain("Issuer charges cannot use the generic refund flow");
    expect(migration).toContain("Card purchases require the dedicated card refund flow");
    expect(migration).toContain("A card purchase refund must return to the original card");
  });

  it("groups multi-slice payments into one activity and one export row", () => {
    expect(migration).toContain("array_agg(e.event_kind order by e.event_kind)");
    expect(migration).toContain("group by e.transaction_id");
    expect(migration).toContain("string_agg(e.event_kind, '|' order by e.event_kind)");
    expect(migration).toContain("sum(e.amount) as liability_effect");
    expect(exportRoute).toContain('"card_liability_effect"');
  });
});

describe("credit-card charge and allocation UI", () => {
  it("explains actual-charge-only behavior and exposes all three issuer kinds", () => {
    expect(chargeForm).toContain("ระบบจะไม่คำนวณดอกเบี้ยจาก APR");
    expect(chargeForm).toContain('value="INTEREST"');
    expect(chargeForm).toContain('value="FEE"');
    expect(chargeForm).toContain('value="LATE_FEE"');
    expect(detail).toContain("/charges/new");
  });

  it("shows four balances and the allocation order before payment", () => {
    expect(paymentForm).toContain("outstanding.principal");
    expect(paymentForm).toContain("outstanding.interest");
    expect(paymentForm).toContain("outstanding.fee");
    expect(paymentForm).toContain("outstanding.lateFee");
    expect(paymentForm).toContain("ค่าปรับ → ค่าธรรมเนียม → ดอกเบี้ย → เงินต้น");
  });
});
