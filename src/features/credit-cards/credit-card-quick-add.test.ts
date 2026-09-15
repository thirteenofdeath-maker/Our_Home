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
  "supabase/migrations/20260914223116_mixed_wallet_credit_card_transactions.sql",
);

describe("credit-card quick add", () => {
  it("matches the three requested card modes inside the slide-up flow", () => {
    for (const label of ["จ่ายบัตรเครดิต", "รับ Cashback", "กดเงินสด"]) {
      expect(form).toContain(label);
    }
    expect(flow).toContain("<CreditCardTransactionForm");
    expect(flow).toContain("<BottomSheet");
  });

  it("uses the transfer template for card payment and cash advance", () => {
    expect(form).toContain('type Picker = "card" | "endpoint" | null');
    expect(form).toContain('label="จาก"');
    expect(form).toContain('label="ไปยัง"');
    expect(form).toContain('placeholder="เลือกต้นทาง"');
    expect(form).toContain('placeholder="เลือกปลายทาง"');
    expect(form).toContain(
      'title={mode === "PAYMENT" ? "เลือกต้นทาง" : "เลือกปลายทาง"}',
    );
    expect(form).toContain('inputMode="decimal"');
    expect(form).toContain('name="amount"');
  });

  it("removes the dashboard arrow and uses one textual sheet back control", () => {
    const dashboardTrigger = flow.slice(
      flow.indexOf('triggerVariant === "dashboard"'),
      flow.indexOf(") : (", flow.indexOf('triggerVariant === "dashboard"')),
    );
    expect(dashboardTrigger).not.toContain('name="chevron"');
    expect(flow).toContain('closeLabel="ย้อนกลับ"');
    expect(flow).not.toContain('aria-label="ย้อนกลับไปเลือกประเภท"');
    expect(flow).toContain("onClose={showBack ? goBack : closeFlow}");
  });

  it("keeps mixed-currency card calculations scoped to card Pockets", () => {
    expect(migration).toContain(
      "public.get_pocket_balance(v_card.system_pocket_id)",
    );
    expect(migration).not.toContain("public.get_wallet_balance");
    expect(migration.match(/pocket_type='CREDIT_CARD'/g)).toHaveLength(2);
  });
});
