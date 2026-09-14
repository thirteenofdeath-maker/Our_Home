import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");
const form = read(
  "src/features/credit-cards/components/CreditCardTransactionForm.tsx",
);
const flow = read("src/features/finance/components/FinanceCreateFlow.tsx");
const migration = read(
  "supabase/migrations/0071_mixed_wallet_credit_card_transactions.sql",
);

describe("credit-card quick add", () => {
  it("matches the three requested card modes inside the slide-up flow", () => {
    for (const label of ["จ่ายบัตรเครดิต", "รับ Cashback", "กดเงินสด"]) {
      expect(form).toContain(label);
    }
    expect(flow).toContain("<CreditCardTransactionForm");
    expect(flow).toContain("<BottomSheet");
  });

  it("uses card and Pocket selectors with a large decimal amount input", () => {
    expect(form).toContain('label="จาก Pocket"');
    expect(form).toContain('label="เข้าบัตรเครดิต"');
    expect(form).toContain('label="เข้า Pocket"');
    expect(form).toContain('inputMode="decimal"');
    expect(form).toContain('name="amount"');
  });

  it("removes the trailing dashboard arrow without removing the back control", () => {
    const dashboardTrigger = flow.slice(
      flow.indexOf('triggerVariant === "dashboard"'),
      flow.indexOf(") : (", flow.indexOf('triggerVariant === "dashboard"')),
    );
    expect(dashboardTrigger).not.toContain('name="chevron"');
    expect(flow).toContain('aria-label="ย้อนกลับไปเลือกประเภท"');
  });

  it("keeps mixed-currency card calculations scoped to card Pockets", () => {
    expect(migration).toContain(
      "public.get_pocket_balance(v_card.system_pocket_id)",
    );
    expect(migration).not.toContain("public.get_wallet_balance");
    expect(migration.match(/pocket_type='CREDIT_CARD'/g)).toHaveLength(2);
  });
});
