import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static regression guard for the exact read-model behaviors Phase U
 * (0051) requires: attributed spending must be excluded from the payer's
 * own PERSONAL totals, included in HOUSEHOLD budget/report totals, never
 * cross currencies, and net a refund/reimbursement correctly. This
 * supplements — and is explicitly NOT a substitute for — the live
 * RLS/Postgres assertions in security/rls.integration.test.ts (currently
 * skipped: no live Supabase project is linked in this environment). A
 * static text match cannot prove the SQL actually executes correctly
 * against real data; it only guards against an accidental future edit
 * silently dropping one of these clauses.
 */
const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0051_household_expense_attribution.sql"), "utf8");

describe("0051 read-model fixes — static regression guard", () => {
  it("get_finance_reports: excludes attributed effects from PERSONAL, includes them for HOUSEHOLD via the membership-checked helper", () => {
    const fn = sql.slice(sql.indexOf("create or replace function public.get_finance_reports"), sql.indexOf("comment on function public.get_finance_reports"));
    expect(fn).toContain("not exists(select 1 from public.household_attributed_expense_effects v where v.transaction_id=t.id)");
    expect(fn).toContain("from public.get_household_attributed_expense_rows(p_household_id,p_start,p_end) r");
    expect(fn).toContain("where p_scope='HOUSEHOLD'");
  });

  it("get_finance_hub_summary: excludes attributed effects from the payer's own monthly/category totals; wallet balances stay untouched (real cash truth)", () => {
    const fn = sql.slice(sql.indexOf("create or replace function public.get_finance_hub_summary"), sql.indexOf("comment on function public.get_finance_hub_summary"));
    expect(fn).toContain("and not exists (select 1 from public.household_attributed_expense_effects v where v.transaction_id = t.id)");
    // wallet_balances CTE must have no such exclusion — it reflects the ledger, not a spending classification.
    const walletBalancesCte = fn.slice(fn.indexOf("wallet_balances as ("), fn.indexOf("currency_totals as ("));
    expect(walletBalancesCte).not.toContain("household_attributed_expense_effects");
  });

  it("get_finance_insights: excludes attributed effects from the expenses pool", () => {
    const fn = sql.slice(sql.indexOf("create or replace function public.get_finance_insights"), sql.indexOf("comment on function public.get_finance_insights"));
    expect(fn).toContain("and not exists(select 1 from public.household_attributed_expense_effects v where v.transaction_id=t.id)");
  });

  it("get_budget_summary: matches spend on scope + owner/household (not just category_id + currency), and adds attributed spend only for HOUSEHOLD budgets, currency-matched", () => {
    const fn = sql.slice(sql.indexOf("create or replace function public.get_budget_summary"), sql.indexOf("comment on function public.get_budget_summary"));
    expect(fn).toContain("(ab.scope = 'PERSONAL' and t.owner_user_id = ab.owner_user_id)");
    expect(fn).toContain("(ab.scope = 'HOUSEHOLD' and t.household_id = ab.household_id)");
    expect(fn).toContain("select * from active_budgets where scope = 'HOUSEHOLD'");
    expect(fn).toContain("and r.currency = hb.currency"); // no FX / no cross-currency budget contribution
  });

  it("household_attributed_expense_effects view: unions the original expense AND any refund/reimbursement against it, so a refund nets against household spend with no duplicate attribution row", () => {
    const view = sql.slice(sql.indexOf("create view public.household_attributed_expense_effects"), sql.indexOf("comment on view public.household_attributed_expense_effects"));
    expect(view).toContain("from public.household_expense_attributions hea");
    expect(view).toContain("from public.expense_adjustments ea");
    expect(view).toContain("join public.household_expense_attributions hea on hea.transaction_id = ea.original_expense_transaction_id");
    expect(view).toContain("union all");
    expect(view).toContain("security_invoker = true");
  });

  it("get_finance_export: shows a real household-category label instead of a blank category, without introducing a new household-wide export mode", () => {
    const fn = sql.slice(sql.indexOf("create or replace function public.get_finance_export"), sql.indexOf("comment on function public.get_finance_export"));
    expect(fn).toContain("coalesce(c.name, hc.name || ' (ครอบครัว: ' || h.name || ')')");
  });
});
