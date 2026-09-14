import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/0069_wallet_opening_balances.sql",
  ),
  "utf8",
);

describe("wallet opening balance migration", () => {
  it("records a regular wallet opening balance in the ledger", () => {
    expect(migration).toContain("'OPENING_BALANCE'");
    expect(migration).toContain("insert into public.transactions");
    expect(migration).toContain("insert into public.transaction_entries");
    expect(migration).toContain("p_initial_balance");
  });

  it("keeps credit cards on their managed card-account path", () => {
    expect(migration).toContain("public.create_credit_card_account(");
    expect(migration).toContain(
      "public.create_credit_card_balance_adjustment(",
    );
    expect(migration).toContain("p_available_credit - p_credit_limit");
    expect(migration).toContain("if p_wallet_type = 'CREDIT_CARD'");
  });

  it("checks authorization and does not expose either helper to anonymous callers", () => {
    expect(migration).toContain("v_user_id uuid := auth.uid()");
    expect(migration).toContain("public.is_household_member(p_household_id)");
    expect(migration).toMatch(/revoke execute[\s\S]+from public, anon;/);
  });
});
