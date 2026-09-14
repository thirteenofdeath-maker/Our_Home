import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/0056_credit_card_purchase_liability.sql"), "utf8");
const enumMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/0055_card_adjustment_transaction_type.sql"), "utf8");
const form = readFileSync(resolve(process.cwd(), "src/features/credit-cards/components/CardPurchaseForm.tsx"), "utf8");
const detail = readFileSync(resolve(process.cwd(), "src/app/(app)/finance/transactions/[transactionId]/page.tsx"), "utf8");

describe("credit-card purchase liability foundation", () => {
  it("keeps CARD_ADJUSTMENT in its own earlier migration", () => {
    expect(enumMigration).toContain("alter type public.transaction_type add value if not exists 'CARD_ADJUSTMENT'");
    expect(migration).not.toContain("alter type public.transaction_type");
  });

  it("classifies real ledger transactions without storing another balance", () => {
    expect(migration).toContain("transaction_id uuid not null references public.transactions");
    expect(migration).not.toMatch(/\b(current_balance|liability|available_credit)\s+numeric/i);
    expect(migration).toContain("credit_card_liability_events_transaction_kind_uniq");
  });

  it("creates the ledger posting and PURCHASE event atomically", () => {
    expect(migration).toContain("set_config('app.creating_classified_card_entry', 'true', true)");
    expect(migration).toContain("public.create_income_expense_transaction(");
    expect(migration).toContain("values (p_card_account_id, 'PURCHASE', p_amount, v_transaction_id, auth.uid())");
  });

  it("returns refunds to the same card and records a negative liability effect", () => {
    expect(migration).toContain("A card purchase refund must return to the original card");
    expect(migration).toContain("'PURCHASE_REFUND', -p_amount");
    expect(migration).toContain("new.adjustment_kind = 'REFUND'");
  });

  it("supports personal-card funded household attribution without exposing generic posting", () => {
    expect(migration).toContain("public.create_attributed_household_expense(");
    expect(migration).toContain("Only your PERSONAL card can fund an attributed household purchase");
    expect(migration).toContain("Managed credit cards require a dedicated card transaction flow");
  });

  it("prevents generic edits from drifting classification and ledger", () => {
    expect(migration).toContain("transactions_protect_card_linked_header");
    expect(migration).toContain("transaction_entries_protect_card_linked_update");
    expect(migration).toContain("Card-linked ledger entries are immutable");
  });
});

describe("credit-card purchase UI", () => {
  it("requires an explicit personal/household choice for a personal card", () => {
    expect(form).toContain("useState<ExpenseScope | null>(fixedScope)");
    expect(form).toContain("ระบบจะไม่เลือกแทนนาย");
    expect(form).toContain('disabled={!scope}');
  });

  it("routes card refunds through the dedicated flow", () => {
    expect(detail).toContain("/purchases/${transaction.transactionId}/refund");
    expect(detail).toContain("!adjustmentOrigin && !cardEvent");
  });
});
