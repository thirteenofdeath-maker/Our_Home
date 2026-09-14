import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0054_credit_card_accounts.sql"),
  "utf8",
);
const table = sql.slice(
  sql.indexOf("create table public.credit_card_accounts"),
  sql.indexOf("comment on table public.credit_card_accounts"),
);
const form = readFileSync(
  resolve(
    process.cwd(),
    "src/features/credit-cards/components/CreditCardForm.tsx",
  ),
  "utf8",
);
const walletApi = readFileSync(
  resolve(process.cwd(), "src/features/wallets/api.ts"),
  "utf8",
);

describe("0054 wallet-backed credit-card foundation", () => {
  it("keeps metadata 1:1 with a real wallet and stores no cached money", () => {
    expect(sql).toContain(
      "wallet_id uuid not null unique references public.wallets",
    );
    expect(table).not.toMatch(
      /\b(current_balance|liability|available_credit|card_credit|statement_balance)\s+numeric/i,
    );
    expect(sql).toContain("public.get_wallet_balance(w.id) as amount");
    expect(sql).toContain("balance.amount as wallet_balance");
    expect(sql).toContain("greatest(0, -balance.amount) as liability");
  });

  it("derives identity/currency from the wallet and validates CREDIT_CARD plus its system pocket", () => {
    expect(sql).toContain("v_wallet.wallet_type <> 'CREDIT_CARD'");
    expect(sql).toContain("v_pocket.wallet_id <> new.wallet_id");
    expect(table).not.toMatch(/\bscope public\.money_scope/);
    expect(table).not.toMatch(/\bcurrency text/);
  });

  it("blocks unclassified postings to managed cards at the database boundary", () => {
    expect(sql).toContain(
      "create trigger transaction_entries_reject_unclassified_managed_card",
    );
    expect(sql).toContain(
      "Managed credit cards require a dedicated card transaction flow",
    );
  });

  it("preserves existing legacy cards but rejects creation of new unmanaged CREDIT_CARD wallets", () => {
    expect(sql).toContain(
      "create trigger wallets_reject_new_unmanaged_credit_card",
    );
    expect(sql).toContain(
      "Create credit cards through create_credit_card_account",
    );
    expect(sql).toContain(
      "set_config('app.creating_managed_card', 'true', true)",
    );
  });

  it("uses RPC-only mutation and wallet-derived RLS visibility", () => {
    expect(sql).toContain("using (public.is_wallet_authorized(wallet_id))");
    expect(sql).toContain(
      "revoke all on public.credit_card_accounts from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant select on public.credit_card_accounts to authenticated",
    );
  });

  it("supports days 1-31 with a real end-of-month clamp", () => {
    expect(sql).toContain("between 1 and 31");
    expect(sql).toContain("interval '1 month - 1 day'");
  });
});

describe("managed-card application boundaries", () => {
  it("requires an explicit scope and exposes no opening-balance field", () => {
    expect(form).toMatch(
      /useState<"PERSONAL" \| "HOUSEHOLD" \| null>\(\s*card\?\.scope \?\? null,?\s*\)/,
    );
    expect(form).toContain("ระบบจะไม่เลือกแทนนาย");
    expect(form).not.toContain('name="openingBalance"');
  });

  it("filters managed cards from generic wallet selectors while preserving legacy cards", () => {
    expect(walletApi).toContain(
      'supabase.from("credit_card_accounts").select("wallet_id")',
    );
    expect(walletApi).toContain("!managedIds.has(wallet.id)");
    expect(walletApi).toContain(
      'return (data ?? []).filter((wallet) => wallet.wallet_type !== "CREDIT_CARD")',
    );
  });
});
