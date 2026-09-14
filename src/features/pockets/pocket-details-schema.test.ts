import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260914230314_update_pocket_details.sql",
  ),
  "utf8",
);

describe("Pocket details ledger update", () => {
  it("authorizes the Wallet and records balance changes in the ledger", () => {
    expect(migration).toContain("public.is_wallet_authorized(p_wallet_id)");
    expect(migration).toContain("public.get_pocket_balance(p_pocket_id)");
    expect(migration).toContain("insert into public.transaction_entries");
    expect(migration).toContain("'OPENING_BALANCE'");
  });

  it("keeps managed credit cards on their dedicated adjustment path", () => {
    expect(migration).toContain(
      "public.create_credit_card_balance_adjustment(",
    );
    expect(migration).toContain(
      "(v_pocket.pocket_type = 'CREDIT_CARD') <> (p_pocket_type = 'CREDIT_CARD')",
    );
  });
});
