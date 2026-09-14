import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildWalletTransferEntries, netWorth, walletBalance } from "@/features/transactions/domain/ledger";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/0061_credit_card_cash_advance.sql"), "utf8");
const form = readFileSync(resolve(process.cwd(), "src/features/credit-cards/components/CreditCardCashAdvanceForm.tsx"), "utf8");
const page = readFileSync(resolve(process.cwd(), "src/app/(app)/finance/cards/[cardId]/cash-advance/page.tsx"), "utf8");
const transactionDetail = readFileSync(resolve(process.cwd(), "src/app/(app)/finance/transactions/[transactionId]/page.tsx"), "utf8");

describe("credit-card cash advance", () => {
  it("moves cash without creating income or expense", () => {
    const entries = buildWalletTransferEntries({
      fromWalletId:"card", fromPocketId:"card-system", toWalletId:"cash", toPocketId:"cash-main", amount:"800.00",
    });
    expect(walletBalance(entries, "card")).toBe("-800.00");
    expect(walletBalance(entries, "cash")).toBe("800.00");
    expect(netWorth(entries)).toBe("0.00");
    expect(migration).toContain("public.create_wallet_transfer(");
    expect(migration).not.toContain("create_income_expense_transaction");
  });

  it("records principal and enforces available credit server-side", () => {
    expect(migration).toContain("'CASH_ADVANCE', p_amount");
    expect(migration).toContain("v_card.credit_limit + public.get_wallet_balance(v_card.wallet_id)");
    expect(migration).toContain("Cash advance exceeds available credit");
    expect(migration).toContain("for update");
  });

  it("rejects unauthorized, archived and card destinations", () => {
    expect(migration).toContain("public.is_wallet_authorized(p_to_wallet_id)");
    expect(migration).toContain("Credit card is archived");
    expect(migration).toContain("Cash advance must go to a non-card wallet");
  });

  it("filters UI destinations by scope, household and currency", () => {
    expect(page).toContain('wallet.wallet_type !== "CREDIT_CARD"');
    expect(page).toContain("wallet.currency === card.currency");
    expect(page).toContain("wallet.scope === card.scope");
    expect(page).toContain("wallet.household_id === card.householdId");
    expect(form).toContain("รายการนี้ไม่ใช่รายรับหรือรายจ่าย");
  });

  it("labels cash-advance void and restore behavior correctly", () => {
    expect(transactionDetail).toContain("เงินจะออกจาก Wallet ปลายทางและยอดค้างบัตรจะลดลงอัตโนมัติ");
    expect(transactionDetail).toContain("กู้คืนการกดเงินสด");
  });
});
