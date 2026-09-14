import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Server Actions in this codebase are not unit-tested against a mock
 * Supabase client anywhere (see the established convention — every
 * write-path assertion lives in the skipped RLS integration suite
 * against a real Postgres instance instead). These are source-level
 * assertions on the exact routing/derivation rules Phase U (0051) adds,
 * consistent with that convention — they catch an accidental regression
 * in which combination maps to which RPC, or a re-introduction of a
 * client-trusted identity field, without requiring a live database.
 */
const source = readFileSync(resolve(process.cwd(), "src/features/transactions/actions.ts"), "utf8");

describe("createExpenseAction — Phase U (0051) scope/wallet routing", () => {
  it("re-derives the funding wallet's REAL scope server-side — never trusts the client's own idea of which wallet is personal/household", () => {
    expect(source).toContain("const wallet = await getWallet(supabase, parsed.data.walletId);");
  });

  it("routes PERSONAL scope + a PERSONAL wallet to the existing normal write path", () => {
    const block = source.slice(source.indexOf("export async function createExpenseAction"));
    expect(block).toContain('if (parsed.data.expenseScope === "PERSONAL") {');
    expect(block).toContain('if (wallet.scope !== "PERSONAL") {');
    expect(block).toContain("await createIncomeExpense(supabase, {");
  });

  it("routes HOUSEHOLD scope + a HOUSEHOLD wallet to the existing normal household write path", () => {
    const block = source.slice(source.indexOf("export async function createExpenseAction"));
    expect(block).toContain('} else if (wallet.scope === "HOUSEHOLD") {');
  });

  it("routes HOUSEHOLD scope + the caller's own PERSONAL wallet to create_attributed_household_expense", () => {
    const block = source.slice(source.indexOf("export async function createExpenseAction"));
    expect(block).toContain("await createAttributedHouseholdExpense(supabase, {");
  });

  it("derives householdId server-side from the caller's OWN primary household membership — never from client-supplied form data", () => {
    const block = source.slice(source.indexOf("export async function createExpenseAction"), source.indexOf("export async function createExpenseAction") + 4000);
    expect(block).toContain("const household = await getMyPrimaryHousehold(supabase, user.id);");
    expect(block).not.toMatch(/formData\.get\("householdId"\)/);
  });

  it("never silently reinterprets an invalid combination — PERSONAL scope with a non-personal wallet returns an error instead of falling through", () => {
    expect(source).toContain('return { error: "กระเป๋าเงินนี้ไม่ใช่กระเป๋าส่วนตัว');
  });
});

describe("updateAttributedHouseholdExpenseAction — Phase U (0051) dedicated edit path", () => {
  it("exists as its own action, separate from updateIncomeExpenseAction, and calls updateAttributedHouseholdExpense", () => {
    expect(source).toContain("export async function updateAttributedHouseholdExpenseAction");
    const block = source.slice(source.indexOf("export async function updateAttributedHouseholdExpenseAction"));
    expect(block).toContain("await updateAttributedHouseholdExpense(supabase, {");
  });

  it("never accepts a household id from the client — the attribution's household is immutable and never re-derived here at all", () => {
    const block = source.slice(
      source.indexOf("export async function updateAttributedHouseholdExpenseAction"),
      source.indexOf("export async function updateAttributedHouseholdExpenseAction") + 2500,
    );
    expect(block).not.toContain('formData.get("householdId")');
  });
});
