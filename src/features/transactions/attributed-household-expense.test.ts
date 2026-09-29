import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const flow = read("src/features/finance/components/FinanceCreateFlow.tsx");
const form = read(
  "src/features/transactions/components/AttributedHouseholdExpenseForm.tsx",
);
const actions = read("src/features/transactions/actions.ts");
const api = read("src/features/transactions/api.ts");
const quickData = read("src/features/finance/quick-add-data.ts");
const financePage = read("src/app/(app)/finance/page.tsx");
const migration = read(
  "supabase/migrations/0051_household_expense_attribution.sql",
);

describe("personal-funded household expense", () => {
  it("offers the funding choice only when the household dashboard supplies its household id", () => {
    expect(financePage).toContain(
      'householdId={scope === "HOUSEHOLD" ? householdId : null}',
    );
    expect(flow).toContain('stage === "expense" && householdId');
    expect(flow).toContain("กระเป๋าครอบครัว");
    expect(flow).toContain("ส่วนตัวของฉัน");
  });

  it("keeps ordinary income and expense switching within the initial wallet ownership boundary", () => {
    expect(quickData).toContain("candidate.scope === wallet.scope");
    expect(quickData).toContain(
      "candidate.owner_user_id === wallet.owner_user_id",
    );
    expect(quickData).toContain(
      "candidate.household_id === wallet.household_id",
    );
  });

  it("loads only the caller's non-card personal wallets and the exact household categories", () => {
    expect(quickData).toContain('wallet.scope === "PERSONAL"');
    expect(quickData).toContain("wallet.owner_user_id === user.id");
    expect(quickData).toContain('wallet.wallet_type !== "CREDIT_CARD"');
    expect(quickData).toContain('scope: "HOUSEHOLD"');
    expect(quickData).toContain("household_id: householdId");
  });

  it("submits the real personal wallet and household category to the existing atomic RPC", () => {
    expect(form).toContain('name="householdId"');
    expect(form).toContain('label="จ่ายจากกระเป๋าส่วนตัว"');
    expect(form).toContain('label="หมวดหมู่ครอบครัว"');
    expect(form).toContain("allowCreate={false}");
    expect(actions).toContain("createAttributedHouseholdExpenseAction");
    expect(api).toContain('"create_attributed_household_expense"');
    expect(api).toContain("p_household_category_id");
  });

  it("returns to the household finance dashboard after a successful save", () => {
    expect(actions).toContain(
      "redirect(`${FINANCE_RETURN_TO}?scope=HOUSEHOLD`)",
    );
  });

  it("deducts the real personal wallet while excluding the item from personal expense totals and including it in household totals", () => {
    expect(migration).toContain(
      "'PERSONAL', auth.uid(), null, 'EXPENSE', null",
    );
    expect(migration).toContain(
      "not exists(select 1 from public.household_attributed_expense_effects v where v.transaction_id=t.id)",
    );
    expect(migration).toContain(
      "from public.get_household_attributed_expense_rows(p_household_id,p_start,p_end) r",
    );
    expect(migration).toContain("where p_scope='HOUSEHOLD'");
  });
});
