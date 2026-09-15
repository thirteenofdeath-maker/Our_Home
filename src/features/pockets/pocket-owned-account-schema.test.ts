import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260914202647_pocket_owned_currency_and_cards.sql",
  ),
  "utf8",
);

describe("Pocket-owned account schema", () => {
  it("moves type and currency ownership to each Pocket", () => {
    expect(sql).toContain("add column if not exists pocket_type");
    expect(sql).toContain("add column if not exists currency text");
    expect(sql).toContain("group by w.id,p.currency");
  });

  it("allows multiple credit-card Pockets in one Wallet container", () => {
    expect(sql).toContain(
      "drop constraint if exists credit_card_accounts_wallet_id_key",
    );
    expect(sql).toContain("create_credit_card_pocket_with_available_credit");
    expect(sql).toContain("cca.system_pocket_id = new.pocket_id");
  });

  it("keeps the previous card-creation RPC compatible during rollout", () => {
    expect(sql).toMatch(
      /create or replace function public\.create_credit_card_account\([\s\S]*create_wallet_container_with_first_pocket/,
    );
  });

  it("requires matching Pocket currencies for transfers", () => {
    expect(sql.match(/v_from\.currency<>v_to\.currency/g)).toHaveLength(2);
    expect(sql).toContain("Transfers require matching pocket currencies");
  });

  it("derives initial card debt from limit minus available credit", () => {
    expect(sql).toContain("p_available_credit-p_credit_limit");
    expect(sql).toContain("public.get_pocket_balance(v_card.system_pocket_id)");
  });
});
