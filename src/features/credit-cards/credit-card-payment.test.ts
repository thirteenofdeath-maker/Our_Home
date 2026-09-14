import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildWalletTransferEntries, netWorth, walletBalance } from "@/features/transactions/domain/ledger";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/0057_credit_card_payments.sql"), "utf8");
const form = readFileSync(resolve(process.cwd(), "src/features/credit-cards/components/CreditCardPaymentForm.tsx"), "utf8");
const page = readFileSync(resolve(process.cwd(), "src/app/(app)/finance/cards/[cardId]/payment/page.tsx"), "utf8");
const detail = readFileSync(resolve(process.cwd(), "src/app/(app)/finance/transactions/[transactionId]/page.tsx"), "utf8");
const exportRoute = readFileSync(resolve(process.cwd(), "src/app/(app)/finance/export/download/route.ts"), "utf8");

describe("credit-card payment ledger", () => {
  it("posts one net-worth-neutral transfer and no second expense", () => {
    const entries = buildWalletTransferEntries({
      fromWalletId: "cash",
      fromPocketId: "cash-main",
      toWalletId: "card",
      toPocketId: "card-system",
      amount: "400.00",
    });
    expect(walletBalance(entries, "cash")).toBe("-400.00");
    expect(walletBalance(entries, "card")).toBe("400.00");
    expect(netWorth(entries)).toBe("0.00");
    expect(migration).toContain("public.create_wallet_transfer(");
    expect(migration).not.toContain("public.create_income_expense_transaction(");
  });

  it("records an immutable negative principal allocation atomically", () => {
    expect(migration).toContain("'PAYMENT_PRINCIPAL', -p_amount");
    expect(migration).toContain("Payment exceeds current card principal");
    expect(migration).toContain("for update");
  });

  it("keeps scope, currency, authorization, pockets and archives under server validation", () => {
    expect(migration).toContain("public.is_wallet_authorized(p_from_wallet_id)");
    expect(migration).toContain("A credit-card payment must come from a non-card wallet");
    expect(migration).toContain("create_wallet_transfer revalidates both wallets, both pockets, scope");
  });

  it("prevents refund, void or restore from making principal negative", () => {
    expect(migration).toContain("Refund exceeds current card principal after payments");
    expect(migration).toContain("transactions_prevent_negative_card_principal");
    expect(migration).toContain("Card principal cannot become negative");
  });

  it("allows classified card payments to void/restore while plain transfers stay blocked", () => {
    expect(migration).toContain("credit_card_liability_events where transaction_id = p_transaction_id");
    expect(migration).toContain("Transfers cannot be voided in this version");
    expect(detail).toContain("hasLinkedCharges || Boolean(cardEvent)");
  });

  it("exports stable card linkage instead of inferring it from a title", () => {
    expect(migration).toContain("card_account_id uuid");
    expect(migration).toContain("card_event_kind text");
    expect(migration).toContain("ccle.event_kind");
    expect(exportRoute).toContain('"card_account_id","card_event_kind"');
  });
});

describe("credit-card payment UI", () => {
  it("shows only same-scope, same-household, same-currency non-card funding wallets", () => {
    expect(page).toContain('wallet.wallet_type !== "CREDIT_CARD"');
    expect(page).toContain("wallet.currency === card.currency");
    expect(page).toContain("wallet.scope === card.scope");
    expect(page).toContain("wallet.household_id === card.householdId");
  });

  it("explains that payment is not another expense and caps the entered amount", () => {
    expect(form).toContain("รายการนี้ไม่ถูกนับเป็นรายจ่ายซ้ำ");
    expect(form).toContain("max={card.liability}");
    expect(form).toContain("sticky bottom-3");
  });
});
