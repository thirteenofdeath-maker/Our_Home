import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static regression guard for migration 0052 (Phase V: Transfer fee and
 * interest) — mirrors the pattern already used for 0051's read-model
 * fixes (household-attribution-read-models.test.ts). This supplements —
 * and is explicitly NOT a substitute for — the live RLS/Postgres
 * assertions in security/rls.integration.test.ts (skipped: no live
 * Supabase project is linked in this environment). A static text match
 * cannot prove the SQL actually executes correctly against real data; it
 * only guards against an accidental future edit silently dropping one of
 * these invariants.
 */
const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0052_transfer_fee_and_interest.sql"), "utf8");

describe("0052 transfer_ledger_links — schema invariants", () => {
  it("charge_transaction_id is the primary key (a charge can only ever link to one transfer)", () => {
    expect(sql).toContain("charge_transaction_id uuid primary key references public.transactions (id)");
  });

  it("kind is restricted to FEE/INTEREST", () => {
    expect(sql).toContain("kind text not null check (kind in ('FEE', 'INTEREST'))");
  });

  it("rejects a self-referencing link (charge cannot equal transfer)", () => {
    expect(sql).toContain("constraint transfer_ledger_links_distinct_chk check (charge_transaction_id <> transfer_transaction_id)");
  });

  it("enforces at most one FEE and one INTEREST per transfer via a composite unique index", () => {
    expect(sql).toContain("create unique index transfer_ledger_links_one_per_kind_idx on public.transfer_ledger_links (transfer_transaction_id, kind)");
  });

  it("validates parent is a TRANSFER, child is an EXPENSE, and scope/owner/household/currency match — procedurally, in a BEFORE INSERT trigger", () => {
    const fn = sql.slice(sql.indexOf("create function public.transfer_ledger_links_validate"), sql.indexOf("create trigger transfer_ledger_links_before_insert"));
    expect(fn).toContain("v_transfer.transaction_type <> 'TRANSFER'");
    expect(fn).toContain("v_charge.transaction_type <> 'EXPENSE'");
    expect(fn).toContain("v_charge.scope <> v_transfer.scope");
    expect(fn).toContain("v_charge.owner_user_id is distinct from v_transfer.owner_user_id");
    expect(fn).toContain("v_charge.household_id is distinct from v_transfer.household_id");
    expect(fn).toContain("v_charge_currency is distinct from v_transfer_currency");
  });

  it("no INSERT/UPDATE/DELETE grant to authenticated — only SELECT", () => {
    expect(sql).toContain("grant select on public.transfer_ledger_links to authenticated;");
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*transfer_ledger_links/i);
  });

  it("SELECT policy follows authorization to the underlying transfer transaction", () => {
    const policy = sql.slice(sql.indexOf("create policy transfer_ledger_links_select"), sql.indexOf("grant select on public.transfer_ledger_links"));
    expect(policy).toContain("t.owner_user_id = auth.uid()");
    expect(policy).toContain("public.is_household_member(t.household_id)");
  });
});

describe("0052 restores the confirmed archived-resource regression", () => {
  it("create_income_expense_transaction rejects an archived wallet and an archived pocket", () => {
    const fn = sql.slice(
      sql.indexOf("create or replace function public.create_income_expense_transaction"),
      sql.indexOf("comment on function public.create_income_expense_transaction"),
    );
    expect(fn).toContain("if v_wallet.is_archived then");
    expect(fn).toContain("if v_pocket.is_archived then");
  });

  it("create_pocket_transfer rejects an archived wallet and archived pockets (both from/to)", () => {
    const fn = sql.slice(sql.indexOf("create function public.create_pocket_transfer"), sql.indexOf("comment on function public.create_pocket_transfer"));
    expect(fn).toContain("if v_wallet.is_archived then");
    expect(fn.match(/is archived and cannot be used in a new transfer/g)?.length).toBe(2);
  });

  it("create_wallet_transfer rejects archived wallets and pockets on BOTH sides", () => {
    const fn = sql.slice(sql.indexOf("create function public.create_wallet_transfer"), sql.indexOf("comment on function public.create_wallet_transfer"));
    expect(fn.match(/is archived and cannot receive new transactions/g)?.length).toBe(2);
    expect(fn.match(/is archived and cannot be used in a new transfer/g)?.length).toBe(2);
  });
});

describe("0052 fee/interest posting behavior", () => {
  it("create_wallet_transfer charges fee/interest to the SOURCE wallet/pocket only, never the destination", () => {
    const fn = sql.slice(sql.indexOf("create function public.create_wallet_transfer"), sql.indexOf("comment on function public.create_wallet_transfer"));
    expect(fn).toContain("'EXPENSE', p_from_wallet_id, p_from_pocket_id, p_fee_category_id, p_fee_amount");
    expect(fn).toContain("'EXPENSE', p_from_wallet_id, p_from_pocket_id, p_interest_category_id, p_interest_amount");
    expect(fn).not.toContain("p_to_wallet_id, p_to_pocket_id, p_fee_category_id");
  });

  it("create_pocket_transfer charges fee/interest to the SAME source pocket used by the transfer principal — never a second funding pocket", () => {
    const fn = sql.slice(sql.indexOf("create function public.create_pocket_transfer"), sql.indexOf("comment on function public.create_pocket_transfer"));
    expect(fn).toContain("'EXPENSE', p_wallet_id, p_from_pocket_id, p_fee_category_id, p_fee_amount");
    expect(fn).toContain("'EXPENSE', p_wallet_id, p_from_pocket_id, p_interest_category_id, p_interest_amount");
  });

  it("both transfer RPCs link each charge via transfer_ledger_links immediately after creating it", () => {
    const walletFn = sql.slice(sql.indexOf("create function public.create_wallet_transfer"), sql.indexOf("comment on function public.create_wallet_transfer"));
    const pocketFn = sql.slice(sql.indexOf("create function public.create_pocket_transfer"), sql.indexOf("comment on function public.create_pocket_transfer"));
    for (const fn of [walletFn, pocketFn]) {
      expect(fn).toContain("values (v_fee_transaction_id, v_transaction_id, 'FEE');");
      expect(fn).toContain("values (v_interest_transaction_id, v_transaction_id, 'INTEREST');");
    }
  });

  it("existing callers omitting the new parameters get identical behavior — new params all default null", () => {
    expect(sql).toContain("p_fee_amount numeric default null,\n  p_fee_category_id uuid default null,\n  p_interest_amount numeric default null,\n  p_interest_category_id uuid default null");
  });
});

describe("0052 atomic void/restore for a transfer + linked charges", () => {
  it("void_transaction still blocks a PLAIN (unlinked) transfer — unchanged for every existing transfer", () => {
    const fn = sql.slice(sql.indexOf("create or replace function public.void_transaction"), sql.indexOf("comment on function public.void_transaction"));
    expect(fn).toContain("v_transaction.transaction_type = 'TRANSFER' and not exists (");
    expect(fn).toContain("select 1 from public.transfer_ledger_links where transfer_transaction_id = p_transaction_id");
  });

  it("sync_transfer_ledger_void_state resolves the whole group (transfer + up to 2 charges) via transfer_ledger_links in both directions", () => {
    const fn = sql.slice(sql.indexOf("create function public.sync_transfer_ledger_void_state"), sql.indexOf("comment on function public.sync_transfer_ledger_void_state"));
    expect(fn).toContain("where tll.transfer_transaction_id = new.id");
    expect(fn).toContain("where tll.charge_transaction_id = new.id");
  });

  it("locks every other group member in ascending-id order before validating or updating (deadlock avoidance)", () => {
    const fn = sql.slice(sql.indexOf("create function public.sync_transfer_ledger_void_state"), sql.indexOf("comment on function public.sync_transfer_ledger_void_state"));
    expect(fn).toContain("order by m.id");
    expect(fn).toContain("foreach v_id in array v_group_ids loop\n    perform 1 from public.transactions where id = v_id for update;\n  end loop;");
  });

  it("refuses the whole void cascade if ANY group member has an active refund/reimbursement", () => {
    const fn = sql.slice(sql.indexOf("create function public.sync_transfer_ledger_void_state"), sql.indexOf("comment on function public.sync_transfer_ledger_void_state"));
    expect(fn).toContain("v_partner_adjustment_total := public.get_expense_adjustment_total(v_id);");
    expect(fn).toContain("if v_partner_adjustment_total > 0 then");
  });

  it("refuses the whole restore cascade if ANY group member's wallet/pocket is archived", () => {
    const fn = sql.slice(sql.indexOf("create function public.sync_transfer_ledger_void_state"), sql.indexOf("comment on function public.sync_transfer_ledger_void_state"));
    expect(fn).toContain("w.is_archived or p.is_archived");
  });

  it("guards against recursive re-triggering exactly like sync_debt_event_void_state", () => {
    const fn = sql.slice(sql.indexOf("create function public.sync_transfer_ledger_void_state"), sql.indexOf("comment on function public.sync_transfer_ledger_void_state"));
    expect(fn).toContain("new.deleted_at is not distinct from old.deleted_at or pg_trigger_depth() > 1");
  });

  it("records the SAME actor/reason/timestamp across the whole group (copies new.* verbatim onto every member)", () => {
    const fn = sql.slice(sql.indexOf("create function public.sync_transfer_ledger_void_state"), sql.indexOf("comment on function public.sync_transfer_ledger_void_state"));
    expect(fn).toContain("set deleted_at = new.deleted_at, voided_by = new.voided_by, void_reason = new.void_reason");
  });

  it("the trigger fires AFTER UPDATE OF deleted_at, same event as the existing debt-event sync trigger", () => {
    expect(sql).toContain("create trigger transactions_sync_transfer_ledger_void\n  after update of deleted_at on public.transactions");
  });
});
